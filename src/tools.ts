import type { BrowserRelay } from './relay.js'

export interface ToolDef {
  name: string
  description: string
  inputSchema?: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
  readOnly?: boolean
}

export const TOOL_DEFS: ToolDef[] = [
  {
    description: 'Check whether the browser relay (Robonine web app with MCP Bridge plugin) is connected. Returns "connected" or "not connected".',
    name: 'check_connection',
    readOnly: true,
  },
]

export function callTool(name: string, args: Record<string, unknown>, relay: BrowserRelay): Promise<unknown> {
  if (name === 'check_connection') {
    return Promise.resolve(relay.connected ? 'connected' : 'not connected')
  }
  return relay.call(name, args)
}
