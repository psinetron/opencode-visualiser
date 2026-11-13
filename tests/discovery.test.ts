import { expect, test } from "bun:test"
import { candidatePorts, discoverServer } from "../visualizer/discovery"
import { startServer } from "../visualizer/ocv-server"

test("validates and bounds the candidate range", () => {
  const previous = process.env.OPENCODE_VISUALIZER_PORT
  try {
    for (const value of ["0", "65536", "abc", "1.5", ""]) {
      process.env.OPENCODE_VISUALIZER_PORT = value
      expect(() => candidatePorts()).toThrow()
    }
    process.env.OPENCODE_VISUALIZER_PORT = "65535"
    expect(candidatePorts()).toEqual([65535])
  } finally {
    if (previous === undefined) delete process.env.OPENCODE_VISUALIZER_PORT
    else process.env.OPENCODE_VISUALIZER_PORT = previous
  }
})

test("fallback and cross-process discovery reuse even with an earlier free port", async () => {
  process.env.OPENCODE_VISUALIZER_PORT = "23173"
  const blocker = Bun.serve({ hostname: "127.0.0.1", port: 23173, fetch: () => new Response("unrelated") })
  try {
    expect(await discoverServer()).toBeNull()
    expect(await startServer()).toBe(23174)
    expect(await discoverServer()).toBe(23174)
    for (const release of [false, true]) {
      if (release) blocker.stop(true)
      const child = Bun.spawn([process.execPath, "--eval", 'import {startServer} from "./visualizer/ocv-server.ts"; console.log(await startServer()); process.exit(0)'], { env: { ...process.env, OPENCODE_VISUALIZER_PORT: "23173" }, stdout: "pipe", stderr: "pipe" })
      expect((await new Response(child.stdout).text()).trim()).toBe("23174")
      expect(await child.exited).toBe(0)
    }
  } finally {
    blocker.stop(true)
  }
})
