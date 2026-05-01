import type { BrowserMessage, BrowserToolDef, ServerMessage } from './protocol.js'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'

const CALL_TIMEOUT_MS = 15_000

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class BrowserRelay {
  private readonly wss: WebSocketServer
  private client: WebSocket | null = null
  private readonly pending = new Map<string, PendingCall>()
  private seq = 0
  onBrowserConnect: (() => void) | null = null

  constructor(port: number) {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port })
    this.wss.on('connection', (ws) => this.onConnection(ws))
  }

  get connected(): boolean {
    return this.client !== null
  }

  private onConnection(ws: WebSocket): void {
    if (this.client) {
      this.client.close()
    }
    this.client = ws
    this.onBrowserConnect?.()

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as BrowserMessage
        if (msg.type === 'result' || msg.type === 'error' || msg.type === 'tools') {
          const pending = this.pending.get(msg.id)
          if (!pending) return
          clearTimeout(pending.timer)
          this.pending.delete(msg.id)
          if (msg.type === 'result') {
            pending.resolve(msg.value)
          } else if (msg.type === 'tools') {
            pending.resolve(msg.tools)
          } else {
            pending.reject(new Error(msg.message))
          }
        }
      } catch {
        // ignore malformed messages
      }
    })

    ws.on('close', () => {
      if (this.client === ws) {
        this.client = null
      }
      for (const [id, p] of this.pending) {
        clearTimeout(p.timer)
        p.reject(new Error('Browser disconnected'))
        this.pending.delete(id)
      }
    })
  }

  async listTools(): Promise<BrowserToolDef[]> {
    if (!this.client) {
      return []
    }
    const id = `list-${++this.seq}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('listTools timed out'))
      }, CALL_TIMEOUT_MS)

      this.pending.set(id, { resolve: (v) => resolve(v as BrowserToolDef[]), reject, timer })

      const msg: ServerMessage = { type: 'list_tools', id }
      this.client!.send(JSON.stringify(msg))
    })
  }

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error(
        'No browser connected. Open the Robonine app, install the MCP Bridge plugin, and connect a robot.',
      )
    }
    const id = `call-${++this.seq}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Tool call "${tool}" timed out after ${CALL_TIMEOUT_MS}ms`))
      }, CALL_TIMEOUT_MS)

      this.pending.set(id, { resolve, reject, timer })

      const msg: ServerMessage = { args, id, tool, type: 'call' }
      this.client!.send(JSON.stringify(msg))
    })
  }

  close(): void {
    this.wss.close()
  }
}
