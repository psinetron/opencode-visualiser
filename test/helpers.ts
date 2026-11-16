import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

/** Minimal stand-in for the global WebSocket that records everything sent and lets tests drive it. */
export class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static readonly OPEN = 1
  readyState = 0
  sent: any[] = []
  closed = false
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((m: unknown) => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
    queueMicrotask(() => {
      if (this.closed) return
      this.readyState = FakeWebSocket.OPEN
      this.onopen?.()
    })
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closed = true
    this.readyState = 3
    queueMicrotask(() => this.onclose?.())
  }
}

export function installFakeWebSocket() {
  FakeWebSocket.instances = []
  ;(globalThis as any).WebSocket = FakeWebSocket
}

export const tempDir = () => mkdtempSync(join(tmpdir(), "ocv-test-"))
export const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms))
