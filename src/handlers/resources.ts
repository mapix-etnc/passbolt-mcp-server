/**
 * Resource handlers – CRUD operations on Passbolt password resources
 */

import type { PassboltClient, PassboltResource } from '../api/client.js'
import type { PassboltCrypto } from '../crypto/openpgp.js'
import type { PassboltAuth } from '../auth/jwt.js'
import type {
  ListResourcesSchema,
  GetResourceSchema,
  CreateResourceSchema,
  UpdateResourceSchema,
  DeleteResourceSchema,
  GeneratePasswordSchema,
} from '../tools/index.js'
import type { z } from 'zod'

// Default resource type UUID for "password" type (Passbolt v4 default)
// Users may override this via env if their instance uses a different type
const PASSWORD_RESOURCE_TYPE_ID =
  process.env.PASSBOLT_RESOURCE_TYPE_ID ?? '669f8c64-242a-59fb-92fc-81f660975fd3'

export class ResourceHandlers {
  constructor(
    private readonly client: PassboltClient,
    private readonly crypto: PassboltCrypto,
    private readonly auth: PassboltAuth,
  ) {}

  async listResources(input: z.infer<typeof ListResourcesSchema>): Promise<PassboltResource[]> {
    return this.client.listResources(input.folder_id)
  }

  async getResource(
    input: z.infer<typeof GetResourceSchema>,
  ): Promise<PassboltResource & { password?: string }> {
    const resource = await this.client.getResource(input.id)

    if (input.include_secret === false) {
      return resource
    }

    const secret = await this.client.getSecret(input.id)
    const decrypted = await this.crypto.decryptSecret(secret.data)

    return {
      ...resource,
      password: decrypted.password,
    }
  }

  async createResource(input: z.infer<typeof CreateResourceSchema>): Promise<PassboltResource> {
    // Get user's own UUID from the current JWT token claims
    // We need the user_id to create the secret entry
    const userId = await this.getUserId()
    const userPublicKey = await this.getUserPublicKey(userId)

    // Encrypt the secret for ourselves (we're the only one at creation time)
    const encryptedSecret = await this.crypto.encryptSecret(
      { password: input.password },
      userPublicKey,
    )

    return this.client.createResource({
      name: input.name,
      username: input.username,
      uri: input.uri,
      description: input.description,
      resource_type_id: PASSWORD_RESOURCE_TYPE_ID,
      folder_parent_id: input.folder_id,
      secrets: [{ user_id: userId, data: encryptedSecret }],
    })
  }

  async updateResource(input: z.infer<typeof UpdateResourceSchema>): Promise<PassboltResource> {
    const updateData: Parameters<PassboltClient['updateResource']>[1] = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.username !== undefined) updateData.username = input.username
    if (input.uri !== undefined) updateData.uri = input.uri
    if (input.description !== undefined) updateData.description = input.description

    if (input.password !== undefined) {
      // When updating password, must re-encrypt for ALL current users
      const permissions = await this.client.getResourcePermissions(input.id)
      const users = await this.client.listUsers()

      const secrets = await Promise.all(
        permissions
          .filter((p) => p.aro === 'User')
          .map(async (p) => {
            const user = users.find((u) => u.id === p.aro_foreign_key)
            if (!user?.gpgkey?.armored_key) {
              throw new Error(`Cannot find GPG key for user ${p.aro_foreign_key}`)
            }
            const encrypted = await this.crypto.encryptSecret(
              { password: input.password! },
              user.gpgkey.armored_key,
            )
            return { user_id: user.id, data: encrypted }
          }),
      )

      updateData.secrets = secrets
    }

    return this.client.updateResource(input.id, updateData)
  }

  async deleteResource(input: z.infer<typeof DeleteResourceSchema>): Promise<{ deleted: string }> {
    await this.client.deleteResource(input.id)
    return { deleted: input.id }
  }

  generatePassword(input: z.infer<typeof GeneratePasswordSchema>): { password: string } {
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const upper = input.include_uppercase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : ''
    const numbers = input.include_numbers ? '0123456789' : ''
    const symbols = input.include_symbols ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : ''
    const charset = lower + upper + numbers + symbols

    const bytes = new Uint8Array(input.length)
    crypto.getRandomValues(bytes)
    const password = Array.from(bytes)
      .map((b) => charset[b % charset.length])
      .join('')

    return { password }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async getUserId(): Promise<string> {
    const userId = process.env.PASSBOLT_USER_ID
    if (!userId) throw new Error('PASSBOLT_USER_ID environment variable is required')
    return userId
  }

  private async getUserPublicKey(userId: string): Promise<string> {
    const user = await this.client.getUser(userId)
    if (!user.gpgkey?.armored_key) {
      throw new Error(`No GPG key found for user ${userId}`)
    }
    return user.gpgkey.armored_key
  }
}
