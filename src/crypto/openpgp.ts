/**
 * OpenPGP crypto utilities for Passbolt
 *
 * Handles:
 * - Decryption of resource secrets (password blobs)
 * - Encryption of secrets for sharing
 */

import * as openpgp from 'openpgp'

export interface DecryptedSecret {
  password: string
  description?: string
  totp?: string
}

export class PassboltCrypto {
  private privateKey: openpgp.PrivateKey | null = null
  private readonly privateKeyArmored: string
  private readonly passphrase: string

  constructor(privateKeyArmored: string, passphrase = '') {
    this.privateKeyArmored = privateKeyArmored
    this.passphrase = passphrase
  }

  /**
   * Lazy-load and cache the decrypted private key.
   */
  private async getPrivateKey(): Promise<openpgp.PrivateKey> {
    if (!this.privateKey) {
      this.privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: this.privateKeyArmored }),
        passphrase: this.passphrase,
      })
    }
    return this.privateKey
  }

  /**
   * Decrypt an ASCII-armored PGP message (resource secret).
   * Returns parsed secret object or raw string if not JSON.
   */
  async decryptSecret(armoredMessage: string): Promise<DecryptedSecret> {
    const privateKey = await this.getPrivateKey()
    const message = await openpgp.readMessage({ armoredMessage })
    const { data } = await openpgp.decrypt({
      message,
      decryptionKeys: privateKey,
      format: 'utf8',
    })

    // openpgp returns string when format='utf8' and input is non-streaming
    const plaintext = data as unknown as string

    // Passbolt v5 stores secrets as JSON; v4 stores plain password string
    try {
      const parsed = JSON.parse(plaintext) as Record<string, unknown>
      return {
        password: (parsed.password as string) ?? '',
        description: parsed.description as string | undefined,
        totp: parsed.totp as string | undefined,
      }
    } catch {
      return { password: plaintext }
    }
  }

  /**
   * Encrypt a secret for a recipient public key (used in sharing).
   */
  async encryptSecret(
    secret: DecryptedSecret,
    recipientPublicKeyArmored: string,
  ): Promise<string> {
    const privateKey = await this.getPrivateKey()
    const recipientKey = await openpgp.readKey({ armoredKey: recipientPublicKeyArmored })

    const plaintext =
      secret.description || secret.totp
        ? JSON.stringify({
            password: secret.password,
            ...(secret.description ? { description: secret.description } : {}),
            ...(secret.totp ? { totp: secret.totp } : {}),
          })
        : secret.password

    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: plaintext }),
      encryptionKeys: recipientKey,
      signingKeys: privateKey,
    })
    return encrypted as unknown as string
  }

  /**
   * Get the fingerprint of the user's public key (for API calls).
   */
  async getFingerprint(): Promise<string> {
    const key = await this.getPrivateKey()
    return key.getFingerprint().toUpperCase()
  }
}
