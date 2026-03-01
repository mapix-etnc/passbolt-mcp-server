/**
 * Sharing handlers – permissions and secret sharing
 */

import type { PassboltClient, PassboltPermission } from '../api/client.js'
import type { PassboltCrypto } from '../crypto/openpgp.js'
import type {
  ShareResourceSchema,
  GetResourcePermissionsSchema,
  ListUsersSchema,
  ListGroupsSchema,
} from '../tools/index.js'
import type { z } from 'zod'

export class ShareHandlers {
  constructor(
    private readonly client: PassboltClient,
    private readonly crypto: PassboltCrypto,
  ) {}

  async listUsers(_input: z.infer<typeof ListUsersSchema>) {
    const users = await this.client.listUsers()
    // Don't expose armored keys to AI – return only metadata
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      name: `${u.profile.first_name} ${u.profile.last_name}`,
      has_gpgkey: !!u.gpgkey,
      fingerprint: u.gpgkey?.fingerprint,
    }))
  }

  async listGroups(_input: z.infer<typeof ListGroupsSchema>) {
    return this.client.listGroups()
  }

  async getResourcePermissions(
    input: z.infer<typeof GetResourcePermissionsSchema>,
  ): Promise<PassboltPermission[]> {
    return this.client.getResourcePermissions(input.resource_id)
  }

  async shareResource(input: z.infer<typeof ShareResourceSchema>): Promise<{ shared: string }> {
    // 1. Get current decrypted secret
    const secret = await this.client.getSecret(input.resource_id)
    const decrypted = await this.crypto.decryptSecret(secret.data)

    // 2. Fetch all users with GPG keys (needed for encryption)
    const allUsers = await this.client.listUsers()

    // 3. Build permissions array and encrypt secret for each User-type permission
    const newSecrets: Array<{ user_id: string; data: string }> = []

    for (const perm of input.permissions) {
      if (perm.aro === 'User') {
        const user = allUsers.find((u) => u.id === perm.aro_foreign_key)
        if (!user?.gpgkey?.armored_key) {
          throw new Error(
            `Cannot find GPG key for user ${perm.aro_foreign_key}. ` +
              `Make sure the user exists and has a GPG key configured.`,
          )
        }
        const encryptedForUser = await this.crypto.encryptSecret(decrypted, user.gpgkey.armored_key)
        newSecrets.push({ user_id: user.id, data: encryptedForUser })
      }
      // Groups: Passbolt handles group member encryption server-side
    }

    await this.client.shareResource(
      input.resource_id,
      input.permissions.map((p) => ({
        aro: p.aro,
        aro_foreign_key: p.aro_foreign_key,
        type: p.type,
      })),
      newSecrets,
    )

    return { shared: input.resource_id }
  }
}
