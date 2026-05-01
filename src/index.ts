#!/usr/bin/env node
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { callTool, TOOL_DEFS } from './tools.js'
import { BrowserRelay } from './relay.js'

const PORT = parseInt(process.env['ROBONINE_MCP_PORT'] ?? '60808', 10)
const relay = new BrowserRelay(PORT)
const server = new Server({ name: 'robonine', version: '1.0.0' }, { capabilities: { tools: { listChanged: true } } })

relay.onBrowserConnect = () => {
  server.sendToolListChanged().catch(() => {})
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const localTools = TOOL_DEFS.map((t) => ({
    ...(t.readOnly ? { annotations: { readOnlyHint: true } } : {}),
    description: t.description,
    inputSchema: t.inputSchema ?? { properties: {}, type: 'object' as const },
    name: t.name,
  }))

  let browserTools: typeof localTools = []
  if (relay.connected) {
    try {
      const defs = await relay.listTools()
      browserTools = defs.map((t) => ({
        ...(t.readOnly ? { annotations: { readOnlyHint: true } } : {}),
        description: t.description,
        inputSchema: t.inputSchema ?? { properties: {}, type: 'object' as const },
        name: t.name,
      }))
    } catch {
      // browser disconnected during listing; omit browser tools
    }
  }

  return { tools: [...localTools, ...browserTools] }
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { arguments: args = {}, name } = req.params

  try {
    const result = await callTool(name, args as Record<string, unknown>, relay)
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2)

    return { content: [{ text, type: 'text' as const }] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    return { content: [{ text: message, type: 'text' as const }], isError: true }
  }
})

const transport = new StdioServerTransport()

await server.connect(transport)
