// OpenCode Visualizer — plugin entrypoint.
//
// One default export serves both plugin APIs (see https://opencode.ai/v2/docs/build/plugins/migrate-v1):
//   - OpenCode 2.x reads `id` + `setup(ctx)`  (V2 plugin API)
//   - OpenCode 1.x calls `server(input)`      (V1 plugin API, object form: OpenCode >= 1.18.29)
// Each adapter only translates its API's events/hooks into calls on the shared core (./core.ts).
import type { Plugin as V1Plugin } from "@opencode-ai/plugin"
import { startVisualizer, mapV2Event } from "./core"
import { startServer } from "./visualizer/ocv-server"

// V1 events forwarded as-is. The frontend only reacts to session.status / session.idle / session.error
// and tool.execute.*; the rest are kept for compatibility with earlier versions of this plugin.
const V1_EVENTS = new Set(["session.status", "session.created", "session.deleted", "session.idle", "session.error", "session.diff", "message.updated", "todo.updated"])

// Structural subset of the OpenCode 2.x plugin context (`@opencode/plugin`) that this plugin uses. Declared locally
// so the V2 SDK (and its dependency tree) is not needed to build or test this package.
interface V2Context {
  location: { directory: string }
  event: { subscribe(options?: { signal?: AbortSignal }): AsyncIterable<{ type: string }> }
  tool: { hook(name: "execute.before" | "execute.after", handler: (event: { tool: string }) => void): Promise<unknown> }
}

interface V2Definition {
  id: string
  setup(ctx: V2Context): Promise<() => void>
}

// ─── OpenCode 2.x ───────────────────────────────────────────────────

const v2: V2Definition = {
  id: "psinetron-opencode-visualizer",
  async setup(ctx) {
    const viz = startVisualizer({ directory: ctx.location.directory, startServer })
    const abort = new AbortController()

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: abort.signal })) {
          const mapped = mapV2Event(event as Parameters<typeof mapV2Event>[0])
          if (mapped) viz.sendEvent(mapped.type, mapped.payload)
        }
      } catch {
        // Stream aborted on unload, or the connection to the server ended.
      }
    })()

    await ctx.tool.hook("execute.before", (event) => viz.sendEvent("tool.execute.before", { tool: event.tool }))
    await ctx.tool.hook("execute.after", (event) => viz.sendEvent("tool.execute.after", { tool: event.tool }))

    return () => {
      abort.abort()
      viz.dispose()
    }
  },
}

// ─── OpenCode 1.x ───────────────────────────────────────────────────

const v1: V1Plugin = async ({ directory }) => {
  const viz = startVisualizer({ directory, startServer })

  return {
    event: async ({ event }) => {
      if (V1_EVENTS.has(event.type)) viz.sendEvent(event.type, event.properties as Record<string, unknown>)
    },
    "tool.execute.before": async (input) => viz.sendEvent("tool.execute.before", { tool: input.tool }),
    "tool.execute.after": async (input) => viz.sendEvent("tool.execute.after", { tool: input.tool }),
  }
}

export default { ...v2, server: v1 }
