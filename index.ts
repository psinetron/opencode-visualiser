import type { Plugin } from "@opencode-ai/plugin"
import { join } from "path"
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs"
import { startServer } from "./visualizer/ocv-server"

let serverPort: number | null = null

let logPath: string | null = null

function initLog(directory: string) {
  const dir = join(directory, ".opencode")
  try { mkdirSync(dir, { recursive: true }) } catch {}
  logPath = join(dir, "ocv-debug.log")
}

function log(msg: string) {
  if (!logPath) return
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { appendFileSync(logPath, line) } catch {}
}

async function tryStartServer(): Promise<boolean> {
  try {
    serverPort = await startServer()
    log(`[plugin] Server available on port ${serverPort}`)
    return true
  } catch (e) {
    serverPort = null
    log(`[plugin] Failed to start server: ${e}`)
    return false
  }
}

// ─── Plugin client ──────────────────────────────────────────────────

const AVAILABLE_SKINS = ["person1", "person2", "person3", "person4", "person5"]

function resolveSkin(cwd: string): string {
  const configDir = join(cwd, ".opencode")
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

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const instanceId = `oc-${process.pid}-${Math.random().toString(36).substring(2, 10)}`

function connectToServer(skin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (serverPort === null) { reject(new Error("No visualizer server available")); return }
    const socket = new WebSocket(`ws://127.0.0.1:${serverPort}`)

    const timeout = setTimeout(() => {
      socket.close()
      reject(new Error("Connection timeout"))
    }, 3000)

    socket.onopen = () => {
      clearTimeout(timeout)
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      ws = socket
      socket.send(
        JSON.stringify({
          type: "register",
          instanceId,
          cwd: process.cwd(),
          skin,
        })
      )
      resolve()
    }

    socket.onerror = () => {
      clearTimeout(timeout)
      socket.close()
      reject(new Error("Connection failed"))
    }

    socket.onclose = () => {
      clearTimeout(timeout)
      ws = null
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          // Leader election: the previous server may have died.
          // Each surviving instance tries to bind the port; only one wins
          // (the rest get EADDRINUSE and stay clients). Random jitter
          // reduces the thundering-herd window when many instances detect
          // the disconnect simultaneously.
          const jitter = Math.floor(Math.random() * 500)
          setTimeout(() => { reconnect(skin) }, jitter)
        }, 1000)
      }
    }

    socket.onmessage = () => {}
  })
}

async function reconnect(skin: string) {
  if (!await tryStartServer()) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void reconnect(skin)
    }, 1000)
    return
  }
  await connectToServer(skin).catch(() => {})
}

function sendEvent(eventType: string, payload: Record<string, unknown> = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(
    JSON.stringify({
      type: "event",
      instanceId,
      event: { type: eventType, ...payload },
    })
  )
}

// ─── Plugin export ──────────────────────────────────────────────────

const VisualizerPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  initLog(directory)
  const skin = resolveSkin(directory)

  await tryStartServer()

  let connected = false
  for (let i = 0; i < 20; i++) {
    try {
      if (serverPort === null) await tryStartServer()
      await connectToServer(skin)
      connected = true
      log(`[plugin] Connected to server on attempt ${i + 1}`)
      break
    } catch (e) {
      if (i === 19) {
        log(`[plugin] Failed to connect after 20 attempts: ${e}`)
      }
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  if (!connected) {
    log(`[plugin] Could not connect to visualizer on port ${serverPort ?? "unknown"}`)
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => { reconnectTimer = null; void reconnect(skin) }, 1000)
    }
  }

  const interestingEvents = new Set([
    "session.status",
    "session.created",
    "session.deleted",
    "session.idle",
    "session.error",
    "session.diff",
    "message.updated",
    "todo.updated",
  ])

  return {
    event: async ({ event }) => {
      if (interestingEvents.has(event.type)) {
        sendEvent(event.type, event.properties as Record<string, unknown>)
      }
    },

    "tool.execute.after": async (input, _output) => {
      sendEvent("tool.execute.after", { tool: input.tool })
    },

    "tool.execute.before": async (input, _output) => {
      sendEvent("tool.execute.before", { tool: input.tool })
    },
  }
}

export { VisualizerPlugin }
export default VisualizerPlugin
