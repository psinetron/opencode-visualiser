// core.ts — OpenCode-version-agnostic part of the visualizer plugin.
//
// Owns the connection to the visualizer server (WebSocket client, leader election, reconnects),
// skin selection, and debug logging. It knows nothing about the OpenCode plugin API: the V1 and V2
// adapters in index.ts translate their respective hooks/events into `sendEvent()` calls.
import { join } from "path"
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs"

export const SERVER_PORT = 5173
export const AVAILABLE_SKINS = ["person1", "person2", "person3", "person4", "person5"]

export interface VisualizerOptions {
  /** Project directory; used for `.opencode/viz-skin.json`, `.opencode/ocv-debug.log` and the registered `cwd`. */
  directory: string
  /** Starts the in-process visualizer server. Returns false when the port is taken (another instance leads). */
  startServer: () => boolean
}

export interface Visualizer {
  /** Sends an event to the frontend. No-op while disconnected. */
  sendEvent(eventType: string, payload?: Record<string, unknown>): void
  /** Disconnects and cancels all pending retries/reconnects. Safe to call more than once. */
  dispose(): void
}

export function resolveSkin(directory: string): string {
  const configDir = join(directory, ".opencode")
  const configPath = join(configDir, "viz-skin.json")
  try {
    const data = JSON.parse(readFileSync(configPath, "utf-8"))
    if (data.skin && AVAILABLE_SKINS.includes(data.skin)) return data.skin
  } catch {}
  const skin = AVAILABLE_SKINS[Math.floor(Math.random() * AVAILABLE_SKINS.length)]
  try {
    mkdirSync(configDir, { recursive: true })
    writeFileSync(configPath, JSON.stringify({ skin }))
  } catch {}
  return skin
}

/**
 * Starts the visualizer server (if this instance wins the leader election) and connects to it in the
 * background. Never throws and never blocks the caller: plugin startup must not wait on the network.
 * State is per call, so several instances in one process (e.g. the shared V2 service) do not interfere.
 */
export function startVisualizer({ directory, startServer }: VisualizerOptions): Visualizer {
  const instanceId = `oc-${process.pid}-${Math.random().toString(36).substring(2, 10)}`
  const skin = resolveSkin(directory)
  const logPath = join(directory, ".opencode", "ocv-debug.log")

  let disposed = false
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const log = (msg: string) => {
    try {
      appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`)
    } catch {}
  }

  const tryStartServer = (): boolean => {
    try {
      const ok = startServer()
      log(ok ? `[plugin] Server running on port ${SERVER_PORT}` : `[plugin] Server not started (port ${SERVER_PORT} in use — another instance is the leader)`)
      return ok
    } catch (e) {
      log(`[plugin] Failed to start server: ${e}`)
      return false
    }
  }

  const connectToServer = (): Promise<void> =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://localhost:${SERVER_PORT}`)

      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error("Connection timeout"))
      }, 3000)

      socket.onopen = () => {
        clearTimeout(timeout)
        if (disposed) {
          socket.close()
          return reject(new Error("Disposed"))
        }
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
        ws = socket
        socket.send(JSON.stringify({ type: "register", instanceId, cwd: directory, skin }))
        resolve()
      }

      socket.onerror = () => {
        clearTimeout(timeout)
        socket.close()
        reject(new Error("Connection failed"))
      }

      socket.onclose = () => {
        clearTimeout(timeout)
        if (ws === socket) ws = null
        if (disposed || reconnectTimer) return
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          if (disposed) return
          // Leader election: the previous server may have died. Each surviving instance tries to bind
          // the port; only one wins (the rest get EADDRINUSE and stay clients). Random jitter reduces
          // the thundering-herd window when many instances detect the disconnect simultaneously.
          setTimeout(() => {
            if (disposed) return
            tryStartServer()
            connectToServer().catch(() => {})
          }, Math.floor(Math.random() * 500))
        }, 1000)
      }

      socket.onmessage = () => {}
    })

  tryStartServer()
  void (async () => {
    for (let i = 0; i < 20 && !disposed; i++) {
      try {
        await connectToServer()
        log(`[plugin] Connected to server on attempt ${i + 1}`)
        return
      } catch (e) {
        if (i === 19) log(`[plugin] Failed to connect after 20 attempts: ${e} — is the daemon running on ws://localhost:${SERVER_PORT}?`)
        await new Promise((r) => setTimeout(r, 300))
      }
    }
  })()

  return {
    sendEvent(eventType, payload = {}) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: "event", instanceId, event: { type: eventType, ...payload } }))
    },
    dispose() {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = null
      try {
        ws?.close()
      } catch {}
      ws = null
    },
  }
}

/**
 * Maps an OpenCode V2 server event to the V1-shaped message the visualizer frontend understands
 * (`session.status` { status }, `session.idle`, `session.error`). Returns undefined for events the
 * frontend does not use.
 */
export function mapV2Event(event: { type: string; data?: { status?: unknown } }): { type: string; payload?: Record<string, unknown> } | undefined {
  switch (event.type) {
    case "session.status":
      return { type: "session.status", payload: { status: event.data?.status } }
    case "session.idle":
      return { type: "session.idle" }
    case "session.execution.failed":
    case "session.step.failed":
      return { type: "session.error" }
    default:
      return undefined
  }
}
