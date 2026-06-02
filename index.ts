import type { Plugin } from "@opencode-ai/plugin"
import { join } from "path"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"

const SERVER_PORT = 5173
const DAEMON_PATH = join(import.meta.dir, "visualizer", "ocv-server.ts")

let daemonStarted = false

function ensureDaemon() {
  if (daemonStarted) return
  daemonStarted = true
  try {
    const proc = Bun.spawn(["bun", DAEMON_PATH], {
      stdio: ["ignore", "ignore", "ignore"],
    })
    proc.unref()
  } catch {}
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
    const socket = new WebSocket(`ws://localhost:${SERVER_PORT}`)

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
      ws = null
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connectToServer(skin).catch(() => {})
        }, 2000)
      }
    }

    socket.onmessage = () => {}
  })
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
  const skin = resolveSkin(directory)

  ensureDaemon()

  for (let i = 0; i < 20; i++) {
    try {
      await connectToServer(skin)
      break
    } catch {
      await new Promise((r) => setTimeout(r, 300))
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
