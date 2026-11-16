import { beforeEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { AVAILABLE_SKINS, mapV2Event, resolveSkin, startVisualizer } from "../core"
import { FakeWebSocket, installFakeWebSocket, tempDir, tick } from "./helpers"

beforeEach(installFakeWebSocket)

describe("mapV2Event", () => {
  test("maps session.status and keeps the status object the frontend reads", () => {
    expect(mapV2Event({ type: "session.status", data: { status: { type: "busy" } } })).toEqual({ type: "session.status", payload: { status: { type: "busy" } } })
  })
  test("maps session.idle", () => {
    expect(mapV2Event({ type: "session.idle" })).toEqual({ type: "session.idle" })
  })
  test.each(["session.execution.failed", "session.step.failed"])("maps %s to session.error", (type) => {
    expect(mapV2Event({ type })).toEqual({ type: "session.error" })
  })
  test("ignores events the frontend does not use", () => {
    expect(mapV2Event({ type: "session.text.delta" })).toBeUndefined()
  })
})

describe("resolveSkin", () => {
  test("persists a random skin and reuses it", () => {
    const dir = tempDir()
    const skin = resolveSkin(dir)
    expect(AVAILABLE_SKINS).toContain(skin)
    expect(JSON.parse(readFileSync(join(dir, ".opencode", "viz-skin.json"), "utf-8"))).toEqual({ skin })
    expect(resolveSkin(dir)).toBe(skin)
  })
})

describe("startVisualizer", () => {
  test("registers with directory and skin, then forwards events", async () => {
    const dir = tempDir()
    const viz = startVisualizer({ directory: dir, startServer: () => true })
    await tick()
    const ws = FakeWebSocket.instances[0]
    expect(ws.url).toBe("ws://localhost:5173")
    expect(ws.sent[0]).toMatchObject({ type: "register", cwd: dir, skin: resolveSkin(dir) })

    viz.sendEvent("tool.execute.before", { tool: "grep" })
    expect(ws.sent[1]).toMatchObject({ type: "event", instanceId: ws.sent[0].instanceId, event: { type: "tool.execute.before", tool: "grep" } })
    viz.dispose()
  })

  test("sendEvent is a no-op before the connection is open", () => {
    const viz = startVisualizer({ directory: tempDir(), startServer: () => true })
    expect(() => viz.sendEvent("session.idle")).not.toThrow()
    viz.dispose()
  })

  test("a throwing startServer does not break startup and is logged", async () => {
    const dir = tempDir()
    const viz = startVisualizer({
      directory: dir,
      startServer: () => {
        throw new Error("boom")
      },
    })
    await tick()
    expect(FakeWebSocket.instances.length).toBe(1)
    expect(existsSync(join(dir, ".opencode", "ocv-debug.log"))).toBe(true)
    expect(readFileSync(join(dir, ".opencode", "ocv-debug.log"), "utf-8")).toContain("Failed to start server: Error: boom")
    viz.dispose()
  })

  test("dispose closes the socket and prevents reconnects", async () => {
    const viz = startVisualizer({ directory: tempDir(), startServer: () => true })
    await tick()
    const ws = FakeWebSocket.instances[0]
    viz.dispose()
    viz.dispose() // idempotent
    expect(ws.closed).toBe(true)
    await tick(1800) // longer than the 1s reconnect delay + 500ms jitter
    expect(FakeWebSocket.instances.length).toBe(1)
  })

  test("reconnects (and retries leader election) after an unexpected close", async () => {
    let starts = 0
    const viz = startVisualizer({ directory: tempDir(), startServer: () => (++starts, true) })
    await tick()
    FakeWebSocket.instances[0].close()
    await tick(1800)
    expect(starts).toBe(2)
    expect(FakeWebSocket.instances.length).toBe(2)
    expect(FakeWebSocket.instances[1].sent[0].type).toBe("register")
    viz.dispose()
  })
})
