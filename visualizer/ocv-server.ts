// ocv-server.ts — WebSocket server for OpenCode Visualizer
// Can run standalone (bun ocv-server.ts) or be imported in-process
import { join } from "path"
import { existsSync } from "fs"
import { platform } from "os"

const SERVER_PORT = 5173

interface PluginClient {
  instanceId: string
  ws: WebSocket
  cwd: string
  skin: string
  connectedAt: number
}

interface FrontendClient {
  ws: WebSocket
}

const pluginClients = new Map<string, PluginClient>()
const frontendClients = new Set<FrontendClient>()

function broadcast(data: Record<string, unknown>) {
  const msg = JSON.stringify(data)
  for (const client of frontendClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try { client.ws.send(msg) } catch {}
    }
  }
}

function trySpawn(cmd: string[], label: string): boolean {
  try {
    const proc = Bun.spawn(cmd, { stdio: ["ignore", "ignore", "ignore"] })
    serverLog(`[ocv-server] Browser launched via ${label} (PID=${proc.pid})`)
    return true
  } catch (e) {
    serverLog(`[ocv-server] Failed to launch browser via ${label}: ${e}`)
    return false
  }
}

function openBrowser() {
  const url = `http://localhost:${SERVER_PORT}`
  const os = platform()

  setTimeout(() => {
    if (frontendClients.size > 0) {
      serverLog("[ocv-server] Frontend already connected, skipping browser launch")
      return
    }
    serverLog(`[ocv-server] Attempting to open browser on ${os}...`)

    if (os === "darwin") {
      const launched =
        trySpawn(["open", "-n", "-a", "Google Chrome", "--args", `--app=${url}`, "--window-size=1024,768"], "Google Chrome") ||
        trySpawn(["open", "-n", "-a", "Chromium", "--args", `--app=${url}`, "--window-size=1024,768"], "Chromium") ||
        trySpawn(["open", url], "default browser")
      if (!launched) serverLog("[ocv-server] Could not open any browser. Open manually: " + url)
    } else if (os === "win32") {
      const launched =
        trySpawn(["cmd.exe", "/c", "start", "chrome", `--app=${url}`, "--window-size=1024,768"], "chrome") ||
        trySpawn(["cmd.exe", "/c", "start", "", url], "default browser")
      if (!launched) serverLog("[ocv-server] Could not open any browser. Open manually: " + url)
    } else {
      const launched =
        trySpawn(["google-chrome", `--app=${url}`, "--window-size=1024,768"], "google-chrome") ||
        trySpawn(["chromium-browser", `--app=${url}`, "--window-size=1024,768"], "chromium-browser") ||
        trySpawn(["xdg-open", url], "xdg-open")
      if (!launched) serverLog("[ocv-server] Could not open any browser. Open manually: " + url)
    }
  }, 3000)
}

let shutdownTimer: ReturnType<typeof setTimeout> | null = null
let server: ReturnType<typeof Bun.serve> | null = null

function resetShutdownTimer() {
  if (shutdownTimer) clearTimeout(shutdownTimer)
  shutdownTimer = setTimeout(() => {
    if (pluginClients.size === 0 && frontendClients.size === 0) {
      server?.stop()
      // Only exit if running standalone, not in-process
      if (isStandalone) process.exit(0)
    }
  }, 300_000)
}

const VISUALIZER_DIR = join(import.meta.dir)

export function startServer(): boolean {
  if (server) return true
  try {
    server = Bun.serve({
      port: SERVER_PORT,
      hostname: "127.0.0.1",
      async fetch(req) {
        if (server!.upgrade(req)) return
        try {
          const url = new URL(req.url)
          const pathname = url.pathname === "/" ? "/index.html" : url.pathname
          const filePath = join(VISUALIZER_DIR, pathname)
          if (existsSync(filePath)) {
            return new Response(Bun.file(filePath), {
              headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
            })
          }
          return new Response("Not found", { status: 404 })
        } catch {
          return new Response("<h1>Server error</h1>", {
            headers: { "Content-Type": "text/html" },
            status: 500,
          })
        }
      },
      websocket: {
        open(_ws) {},
        message(ws, message) {
          let data: Record<string, unknown>
          try { data = JSON.parse(message as string) } catch { return }

          switch (data.type) {
            case "register": {
              const id = data.instanceId as string
              pluginClients.set(id, {
                instanceId: id,
                ws,
                cwd: (data.cwd as string) || "",
                skin: (data.skin as string) || "",
                connectedAt: Date.now(),
              })
              broadcast({ type: "instance.added", instanceId: id, cwd: data.cwd, skin: data.skin })
              ws.send(JSON.stringify({ type: "registered" }))
              openBrowser()
              resetShutdownTimer()
              break
            }
            case "frontend.register": {
              frontendClients.add({ ws })
              const instances = [...pluginClients.values()].map((c) => ({
                instanceId: c.instanceId,
                cwd: c.cwd,
                skin: c.skin,
              }))
              ws.send(JSON.stringify({ type: "state.sync", instances }))
              break
            }
            case "event": {
              broadcast({ type: "instance.event", instanceId: data.instanceId, event: data.event })
              break
            }
          }
        },
        close(ws) {
          for (const [id, client] of pluginClients) {
            if (client.ws === ws) {
              pluginClients.delete(id)
              broadcast({ type: "instance.removed", instanceId: id })
              break
            }
          }
          for (const client of frontendClients) {
            if (client.ws === ws) {
              frontendClients.delete(client)
              break
            }
          }
          resetShutdownTimer()
        },
      },
    })

    serverLog(`[ocv-server] Listening on http://localhost:${SERVER_PORT}`)
    return true
  } catch (e) {
    serverLog(`[ocv-server] Failed to start server on port ${SERVER_PORT}: ${e}`)
    return false
  }
}

// Detect if running standalone (bun ocv-server.ts) vs imported
const isStandalone = import.meta.main === true

function serverLog(msg: string) {
  if (isStandalone) console.log(msg)
}

if (isStandalone) {
  if (!startServer()) {
    console.error(`[ocv-server] Port ${SERVER_PORT} may already be in use`)
    process.exit(1)
  }
}
