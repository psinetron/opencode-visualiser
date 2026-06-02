// ocv-server.ts — standalone WebSocket server daemon
// Lives independently of any opencode instance — survives plugin process kills
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

function openBrowser() {
  const url = `http://localhost:${SERVER_PORT}`
  const os = platform()

  setTimeout(() => {
    if (frontendClients.size > 0) return
    try {
      if (os === "darwin") {
        Bun.spawn(["open", "-n", "-a", "Google Chrome", "--args", `--app=${url}`, "--window-size=1024,768"], {
          stdio: ["ignore", "ignore", "ignore"],
        })
      } else if (os === "win32") {
        Bun.spawn(["cmd.exe", "/c", "start", "chrome", `--app=${url}`, "--window-size=1024,768"], {
          stdio: ["ignore", "ignore", "ignore"],
        })
      } else {
        Bun.spawn(["google-chrome", `--app=${url}`, "--window-size=1024,768"], {
          stdio: ["ignore", "ignore", "ignore"],
        })
      }
    } catch {
      // Nothing to do — user can open manually
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
      process.exit(0)
    }
  }, 300_000)
}

const VISUALIZER_DIR = import.meta.dir

server = Bun.serve({
  port: SERVER_PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    if (server.upgrade(req)) return
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

console.log(`[ocv-server] Listening on http://localhost:${SERVER_PORT}`)
