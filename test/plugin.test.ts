import { beforeEach, describe, expect, mock, test } from "bun:test"
import { FakeWebSocket, installFakeWebSocket, tempDir, tick } from "./helpers"

// Never bind the real port 5173 (a live OpenCode may own it).
mock.module("../visualizer/ocv-server", () => ({ startServer: () => true }))
const plugin = (await import("../index")).default
const tui = (await import("../tui")).default

beforeEach(installFakeWebSocket)

const eventsSent = () => FakeWebSocket.instances.flatMap((w) => w.sent).filter((m) => m.type === "event").map((m) => m.event)

describe("default export shape", () => {
  test("satisfies the V2 definition contract (object with id + setup)", () => {
    expect(typeof plugin).toBe("object")
    expect(typeof plugin.id).toBe("string")
    expect(plugin.id.length).toBeGreaterThan(0)
    expect(typeof plugin.setup).toBe("function")
  })
  test("exposes the V1 server() entrypoint", () => {
    expect(typeof plugin.server).toBe("function")
  })
})

describe("V2 adapter", () => {
  test("translates events and tool hooks, and cleans up on unload", async () => {
    const hooks: Record<string, (e: any) => void> = {}
    let signal!: AbortSignal
    const queue: any[] = [
      { type: "session.status", data: { status: { type: "busy" } } },
      { type: "session.text.delta", data: {} },
      { type: "session.idle", data: {} },
      { type: "session.execution.failed", data: {} },
    ]
    const ctx = {
      location: { directory: tempDir() },
      event: {
        subscribe: ({ signal: s }: { signal: AbortSignal }) => {
          signal = s
          return (async function* () {
            for (const e of queue) yield e
          })()
        },
      },
      tool: { hook: async (name: string, fn: (e: any) => void) => void (hooks[name] = fn) },
    }

    const cleanup = (await plugin.setup(ctx as any)) as () => void
    await tick()
    hooks["execute.before"]({ tool: "read" })
    hooks["execute.after"]({ tool: "read" })

    expect(eventsSent()).toEqual([
      { type: "session.status", status: { type: "busy" } },
      { type: "session.idle" },
      { type: "session.error" },
      { type: "tool.execute.before", tool: "read" },
      { type: "tool.execute.after", tool: "read" },
    ])

    cleanup()
    expect(signal.aborted).toBe(true)
    expect(FakeWebSocket.instances[0].closed).toBe(true)
  })
})

describe("V1 adapter", () => {
  test("forwards whitelisted events with their properties and tool hooks", async () => {
    const dir = tempDir()
    const hooks: any = await (plugin.server as any)({ directory: dir })
    await tick()

    expect(FakeWebSocket.instances[0].sent[0]).toMatchObject({ type: "register", cwd: dir })

    await hooks.event({ event: { type: "session.status", properties: { sessionID: "s1", status: { type: "busy" } } } })
    await hooks.event({ event: { type: "message.part.updated", properties: {} } }) // not whitelisted
    await hooks["tool.execute.before"]({ tool: "bash" })
    await hooks["tool.execute.after"]({ tool: "bash" })

    expect(eventsSent()).toEqual([
      { type: "session.status", sessionID: "s1", status: { type: "busy" } },
      { type: "tool.execute.before", tool: "bash" },
      { type: "tool.execute.after", tool: "bash" },
    ])
  })
})

describe("TUI entrypoint", () => {
  test("satisfies the V2 TUI definition contract (object with id + setup)", () => {
    expect(typeof tui).toBe("object")
    expect(typeof tui.id).toBe("string")
    expect(tui.id.length).toBeGreaterThan(0)
    expect(typeof tui.setup).toBe("function")
  })

  test("V2 setup() registers the /visualizer command and toasts the URL", async () => {
    const messages: string[] = []
    let commands: any[] = []
    const api = {
      keymap: {
        layer: (factory: () => { commands?: any[] }) => void (commands = [...(factory().commands ?? [])]),
      },
      ui: { toast: { show: ({ message }: { message: string }) => void messages.push(message) } },
    }

    await tui.setup(api as any)

    expect(commands.map((c) => c.slash?.name)).toEqual(["visualizer"])
    commands[0].run()
    expect(messages).toEqual(["Visualizer: http://localhost:5173"])
  })

  test("exposes the V1 tui() entrypoint that registers the same command", async () => {
    const messages: string[] = []
    let commands: any[] = []
    const api = {
      command: { register: (cb: () => any[]) => void (commands = cb()) },
      ui: { toast: ({ message }: { message: string }) => void messages.push(message) },
    }

    await (tui as any).tui(api)

    expect(commands.map((c) => c.slash?.name)).toEqual(["visualizer"])
    commands[0].onSelect()
    expect(messages).toEqual(["Visualizer: http://localhost:5173"])
  })
})
