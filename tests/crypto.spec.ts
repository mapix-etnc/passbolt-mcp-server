/**
 * Unit tests for PassboltCrypto (openpgp.ts)
 *
 * Tests encrypt/decrypt round-trip using a freshly generated ephemeral key pair,
 * so no real Passbolt instance or stored keys are needed.
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import * as openpgp from 'openpgp'
import { PassboltCrypto, type DecryptedSecret } from '../src/crypto/openpgp.js'

// Ephemeral key pair generated once for the whole test suite
let armoredPrivateKey: string
let armoredPublicKey: string
const PASSPHRASE = 'test-passphrase-123'

beforeAll(async () => {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'rsa',
    rsaBits: 2048,
    userIDs: [{ name: 'Test User', email: 'test@example.com' }],
    passphrase: PASSPHRASE,
  })
  armoredPrivateKey = privateKey
  armoredPublicKey = publicKey
}, 30_000)

describe('PassboltCrypto', () => {
  describe('encryptSecret / decryptSecret round-trip', () => {
    it('plain password (no JSON wrapping)', async () => {
      const crypto = new PassboltCrypto(armoredPrivateKey, PASSPHRASE)

      const secret: DecryptedSecret = { password: 'super-secret-password!' }
      const encrypted = await crypto.encryptSecret(secret, armoredPublicKey)

      expect(typeof encrypted).toBe('string')
      expect(encrypted).toMatch(/^-----BEGIN PGP MESSAGE-----/)

      const decrypted = await crypto.decryptSecret(encrypted)
      expect(decrypted.password).toBe('super-secret-password!')
      expect(decrypted.description).toBeUndefined()
      expect(decrypted.totp).toBeUndefined()
    })

    it('password + description (JSON wrapping)', async () => {
      const crypto = new PassboltCrypto(armoredPrivateKey, PASSPHRASE)

      const secret: DecryptedSecret = {
        password: 'p@ssw0rd',
        description: 'Login for staging server',
      }
      const encrypted = await crypto.encryptSecret(secret, armoredPublicKey)
      const decrypted = await crypto.decryptSecret(encrypted)

      expect(decrypted.password).toBe('p@ssw0rd')
      expect(decrypted.description).toBe('Login for staging server')
      expect(decrypted.totp).toBeUndefined()
    })

    it('password + totp (JSON wrapping)', async () => {
      const crypto = new PassboltCrypto(armoredPrivateKey, PASSPHRASE)

      const secret: DecryptedSecret = {
        password: 'mypassword',
        totp: 'otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP',
      }
      const encrypted = await crypto.encryptSecret(secret, armoredPublicKey)
      const decrypted = await crypto.decryptSecret(encrypted)

      expect(decrypted.password).toBe('mypassword')
      expect(decrypted.totp).toBe('otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP')
    })

    it('decryptSecret handles Passbolt v4 plain-string secrets', async () => {
      // Simulate a v4 secret that is just a raw password (not JSON)
      const crypto = new PassboltCrypto(armoredPrivateKey, PASSPHRASE)
      const pubKey = await openpgp.readKey({ armoredKey: armoredPublicKey })
      const privKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: armoredPrivateKey }),
        passphrase: PASSPHRASE,
      })

      // Encrypt a raw (non-JSON) string directly
      const rawEncrypted = (await openpgp.encrypt({
        message: await openpgp.createMessage({ text: 'just-a-password' }),
        encryptionKeys: pubKey,
        signingKeys: privKey,
      })) as unknown as string

      const decrypted = await crypto.decryptSecret(rawEncrypted)
      expect(decrypted.password).toBe('just-a-password')
    })
  })

  describe('getFingerprint', () => {
    it('returns uppercase hex fingerprint', async () => {
      const crypto = new PassboltCrypto(armoredPrivateKey, PASSPHRASE)
      const fingerprint = await crypto.getFingerprint()

      expect(typeof fingerprint).toBe('string')
      expect(fingerprint).toMatch(/^[0-9A-F]{40}$/)
    })
  })

  describe('constructor passphrase', () => {
    it('throws when passphrase is wrong', async () => {
      const crypto = new PassboltCrypto(armoredPrivateKey, 'wrong-passphrase')
      await expect(crypto.getFingerprint()).rejects.toThrow()
    })
  })
})
