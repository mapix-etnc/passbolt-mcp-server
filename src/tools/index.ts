/**
 * MCP Tool definitions with Zod schemas
 *
 * Defines all available tools and their input schemas.
 */

import { z } from 'zod'

// ─── Shared schemas ──────────────────────────────────────────────────────────

export const UuidSchema = z.string().uuid()

export const PermissionTypeSchema = z
  .union([z.literal(1), z.literal(7), z.literal(15)])
  .describe('1=Read, 7=Update, 15=Owner')

// ─── Tool input schemas ──────────────────────────────────────────────────────

export const ListResourcesSchema = z.object({
  folder_id: z.string().uuid().optional().describe('Filter resources by folder ID'),
})

export const GetResourceSchema = z.object({
  id: UuidSchema.describe('Resource UUID'),
  include_secret: z
    .boolean()
    .optional()
    .default(true)
    .describe('Decrypt and return the password'),
})

export const CreateResourceSchema = z.object({
  name: z.string().min(1).describe('Resource name (required)'),
  username: z.string().optional().describe('Username / login'),
  uri: z.string().optional().describe('URL or URI'),
  description: z.string().optional().describe('Description'),
  password: z.string().describe('Password to encrypt and store'),
  folder_id: z.string().uuid().optional().describe('Parent folder UUID'),
})

export const UpdateResourceSchema = z.object({
  id: UuidSchema.describe('Resource UUID to update'),
  name: z.string().min(1).optional(),
  username: z.string().optional(),
  uri: z.string().optional(),
  description: z.string().optional(),
  password: z.string().optional().describe('New password (re-encrypts for all users)'),
})

export const DeleteResourceSchema = z.object({
  id: UuidSchema.describe('Resource UUID to delete'),
})

export const GeneratePasswordSchema = z.object({
  length: z.number().int().min(8).max(128).optional().default(20),
  include_numbers: z.boolean().optional().default(true),
  include_symbols: z.boolean().optional().default(true),
  include_uppercase: z.boolean().optional().default(true),
})

// Folders
export const ListFoldersSchema = z.object({})

export const CreateFolderSchema = z.object({
  name: z.string().min(1).describe('Folder name'),
  parent_id: z.string().uuid().optional().describe('Parent folder UUID'),
})

export const UpdateFolderSchema = z.object({
  id: UuidSchema.describe('Folder UUID'),
  name: z.string().min(1).describe('New folder name'),
})

export const DeleteFolderSchema = z.object({
  id: UuidSchema.describe('Folder UUID to delete'),
})

export const MoveResourceSchema = z.object({
  resource_id: UuidSchema.describe('Resource UUID to move'),
  folder_id: z.string().uuid().nullable().describe('Target folder UUID, or null for root'),
})

// Users / Groups
export const ListUsersSchema = z.object({})
export const ListGroupsSchema = z.object({})

// Sharing
export const ShareResourceSchema = z.object({
  resource_id: UuidSchema.describe('Resource UUID to share'),
  permissions: z
    .array(
      z.object({
        aro: z.enum(['User', 'Group']),
        aro_foreign_key: UuidSchema.describe('User or Group UUID'),
        type: PermissionTypeSchema,
      }),
    )
    .min(1),
})

export const GetResourcePermissionsSchema = z.object({
  resource_id: UuidSchema.describe('Resource UUID'),
})

// Status
export const GetStatusSchema = z.object({})

// ─── Tool registry ───────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  // Resources
  {
    name: 'list_resources',
    description: 'List all accessible password resources, optionally filtered by folder.',
    inputSchema: ListResourcesSchema,
  },
  {
    name: 'get_resource',
    description:
      'Get a resource by ID. Decrypts and returns the password by default. ' +
      'WARNING: The decrypted password will be visible in the AI context.',
    inputSchema: GetResourceSchema,
  },
  {
    name: 'create_resource',
    description: 'Create a new password resource.',
    inputSchema: CreateResourceSchema,
  },
  {
    name: 'update_resource',
    description: 'Update an existing password resource (metadata and/or password).',
    inputSchema: UpdateResourceSchema,
  },
  {
    name: 'delete_resource',
    description:
      'Permanently delete a password resource. This action cannot be undone.',
    inputSchema: DeleteResourceSchema,
  },
  {
    name: 'generate_password',
    description: 'Generate a secure random password.',
    inputSchema: GeneratePasswordSchema,
  },
  // Folders
  {
    name: 'list_folders',
    description: 'List all accessible folders.',
    inputSchema: ListFoldersSchema,
  },
  {
    name: 'create_folder',
    description: 'Create a new folder.',
    inputSchema: CreateFolderSchema,
  },
  {
    name: 'update_folder',
    description: 'Rename a folder.',
    inputSchema: UpdateFolderSchema,
  },
  {
    name: 'delete_folder',
    description: 'Delete a folder (resources inside are NOT deleted, they move to root).',
    inputSchema: DeleteFolderSchema,
  },
  {
    name: 'move_resource',
    description: 'Move a resource to a different folder (or to root).',
    inputSchema: MoveResourceSchema,
  },
  // Users / Groups
  {
    name: 'list_users',
    description: 'List all users in the Passbolt instance (needed for sharing).',
    inputSchema: ListUsersSchema,
  },
  {
    name: 'list_groups',
    description: 'List all groups in the Passbolt instance.',
    inputSchema: ListGroupsSchema,
  },
  // Sharing
  {
    name: 'share_resource',
    description:
      'Share a resource with users or groups. Sets permissions and re-encrypts the secret.',
    inputSchema: ShareResourceSchema,
  },
  {
    name: 'get_resource_permissions',
    description: 'List current permissions (who has access) for a resource.',
    inputSchema: GetResourcePermissionsSchema,
  },
  // Utility
  {
    name: 'get_status',
    description: 'Check Passbolt server status and API version.',
    inputSchema: GetStatusSchema,
  },
] as const
