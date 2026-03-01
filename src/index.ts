#!/usr/bin/env node
/**
 * Passbolt MCP Server
 *
 * Exposes Passbolt password manager resources as MCP tools.
 * Communicates over stdio using the MCP protocol.
 *
 * Required environment variables:
 *   PASSBOLT_BASE_URL    - e.g. https://passbolt.example.com
 *   PASSBOLT_USER_ID     - UUID of the Passbolt user
 *   PASSBOLT_PRIVATE_KEY - ASCII-armored GPG private key
 *   PASSBOLT_PASSPHRASE  - (optional) passphrase for the private key
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { PassboltAuth } from './auth/jwt.js'
import { PassboltClient } from './api/client.js'
import { PassboltCrypto } from './crypto/openpgp.js'
import { ResourceHandlers } from './handlers/resources.js'
import { FolderHandlers } from './handlers/folders.js'
import { ShareHandlers } from './handlers/shares.js'
import {
  TOOL_DEFINITIONS,
  ListResourcesSchema,
  GetResourceSchema,
  CreateResourceSchema,
  UpdateResourceSchema,
  DeleteResourceSchema,
  GeneratePasswordSchema,
  ListFoldersSchema,
  CreateFolderSchema,
  UpdateFolderSchema,
  DeleteFolderSchema,
  MoveResourceSchema,
  ListUsersSchema,
  ListGroupsSchema,
  ShareResourceSchema,
  GetResourcePermissionsSchema,
} from './tools/index.js'

// ─── Config validation ───────────────────────────────────────────────────────

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Error: Required environment variable ${name} is not set.`)
    process.exit(1)
  }
  return value
}

const BASE_URL = getRequiredEnv('PASSBOLT_BASE_URL')
const USER_ID = getRequiredEnv('PASSBOLT_USER_ID')
const PRIVATE_KEY = getRequiredEnv('PASSBOLT_PRIVATE_KEY').replace(/\\n/g, '\n')
const PASSPHRASE = process.env.PASSBOLT_PASSPHRASE ?? ''

// ─── Initialize services ─────────────────────────────────────────────────────

const auth = new PassboltAuth(BASE_URL, USER_ID, PRIVATE_KEY, PASSPHRASE)
const client = new PassboltClient(BASE_URL, auth)
const crypto = new PassboltCrypto(PRIVATE_KEY, PASSPHRASE)

const resources = new ResourceHandlers(client, crypto, auth)
const folders = new FolderHandlers(client)
const shares = new ShareHandlers(client, crypto)

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'passbolt-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, () => {
  const tools: Tool[] = TOOL_DEFINITIONS.map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: zodToJsonSchema(def.inputSchema) as Tool['inputSchema'],
  }))
  return { tools }
})

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await dispatch(name, args as any)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

// ─── Tool dispatcher ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatch(toolName: string, args: Record<string, any>): Promise<unknown> {
  switch (toolName) {
    // Resources
    case 'list_resources':
      return resources.listResources(ListResourcesSchema.parse(args))
    case 'get_resource':
      return resources.getResource(GetResourceSchema.parse(args))
    case 'create_resource':
      return resources.createResource(CreateResourceSchema.parse(args))
    case 'update_resource':
      return resources.updateResource(UpdateResourceSchema.parse(args))
    case 'delete_resource':
      return resources.deleteResource(DeleteResourceSchema.parse(args))
    case 'generate_password':
      return resources.generatePassword(GeneratePasswordSchema.parse(args))

    // Folders
    case 'list_folders':
      return folders.listFolders(ListFoldersSchema.parse(args))
    case 'create_folder':
      return folders.createFolder(CreateFolderSchema.parse(args))
    case 'update_folder':
      return folders.updateFolder(UpdateFolderSchema.parse(args))
    case 'delete_folder':
      return folders.deleteFolder(DeleteFolderSchema.parse(args))
    case 'move_resource':
      return folders.moveResource(MoveResourceSchema.parse(args))

    // Users / Groups
    case 'list_users':
      return shares.listUsers(ListUsersSchema.parse(args))
    case 'list_groups':
      return shares.listGroups(ListGroupsSchema.parse(args))

    // Sharing
    case 'share_resource':
      return shares.shareResource(ShareResourceSchema.parse(args))
    case 'get_resource_permissions':
      return shares.getResourcePermissions(GetResourcePermissionsSchema.parse(args))

    // Status
    case 'get_status':
      return client.getStatus()

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Passbolt MCP server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
