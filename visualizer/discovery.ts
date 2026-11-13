export const HEALTH_PATH = "/__opencode_visualizer_health"
export const HEALTH_ID = "opencode-visualizer-v1"
export const PORT_COUNT = 20

export function candidatePorts(): number[] {
  const value = process.env.OPENCODE_VISUALIZER_PORT ?? "5173"
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error("OPENCODE_VISUALIZER_PORT must be an integer from 1 to 65535")
  }
  const start = Number(value)
  return Array.from({ length: Math.min(PORT_COUNT, 65536 - start) }, (_, i) => start + i)
}

export function visualizerUrl(port: number): string {
  return `http://127.0.0.1:${port}`
}

export async function discoverServer(ports = candidatePorts()): Promise<number | null> {
  const results = await Promise.all(ports.map(async (port) => {
    try {
      const response = await fetch(`${visualizerUrl(port)}${HEALTH_PATH}`, {
        signal: AbortSignal.timeout(500),
        redirect: "error",
      })
      if (response.ok && await response.text() === HEALTH_ID) return port
    } catch {}
    return null
  }))
  return results.find((port) => port !== null) ?? null
}
