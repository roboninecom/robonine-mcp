export interface BrowserToolDef {
  name: string
  description: string
  inputSchema?: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
  readOnly?: boolean
}

// Messages sent from the MCP server to the browser tab
export type ServerMessage =
  | { type: 'call'; id: string; tool: string; args: Record<string, unknown> }
  | { type: 'list_tools'; id: string }

// Messages sent from the browser tab to the MCP server
export type BrowserMessage =
  | { type: 'register' }
  | { type: 'result'; id: string; value: unknown }
  | { type: 'error'; id: string; message: string }
  | { type: 'tools'; id: string; tools: BrowserToolDef[] }
