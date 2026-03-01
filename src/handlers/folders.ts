/**
 * Folder handlers – CRUD and move operations
 */

import type { PassboltClient, PassboltFolder } from '../api/client.js'
import type {
  ListFoldersSchema,
  CreateFolderSchema,
  UpdateFolderSchema,
  DeleteFolderSchema,
  MoveResourceSchema,
} from '../tools/index.js'
import type { z } from 'zod'

export class FolderHandlers {
  constructor(private readonly client: PassboltClient) {}

  async listFolders(_input: z.infer<typeof ListFoldersSchema>): Promise<PassboltFolder[]> {
    return this.client.listFolders()
  }

  async createFolder(input: z.infer<typeof CreateFolderSchema>): Promise<PassboltFolder> {
    return this.client.createFolder(input.name, input.parent_id)
  }

  async updateFolder(input: z.infer<typeof UpdateFolderSchema>): Promise<PassboltFolder> {
    return this.client.updateFolder(input.id, input.name)
  }

  async deleteFolder(input: z.infer<typeof DeleteFolderSchema>): Promise<{ deleted: string }> {
    await this.client.deleteFolder(input.id)
    return { deleted: input.id }
  }

  async moveResource(input: z.infer<typeof MoveResourceSchema>): Promise<{ moved: string }> {
    await this.client.moveResource(input.resource_id, input.folder_id)
    return { moved: input.resource_id }
  }
}
