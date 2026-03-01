/**
 * Passbolt JWT Authentication
 *
 * Implements the Passbolt JWT login flow:
 * 1. Fetch server public key
 * 2. Generate and encrypt a challenge
 * 3. POST /auth/jwt/login.json → receive access_token + refresh_token
 * 4. Cache tokens in memory + auto-refresh before expiry
 */

import * as openpgp from 'openpgp'

export interface JwtTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms
}

interface ServerVerifyResponse {
  body: {
    keydata: string // ASCII-armored server public key
    fingerprint: string
  }
}

interface JwtLoginResponse {
  body: {
    access_token: string
    refresh_token: string
  }
}

export class PassboltAuth {
  private tokens: JwtTokens | null = null
  private readonly baseUrl: string
  private readonly userId: string
  private readonly privateKeyArmored: string
  private readonly passphrase: string

  constructor(baseUrl: string, userId: string, privateKeyArmored: string, passphrase = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.userId = userId
    this.privateKeyArmored = privateKeyArmored
    this.passphrase = passphrase
  }

  /**
   * Returns a valid access token, refreshing if necessary.
   */
  async getAccessToken(): Promise<string> {
    if (this.tokens && this.tokens.expiresAt > Date.now() + 60_000) {
      return this.tokens.accessToken
    }
    if (this.tokens?.refreshToken) {
      await this.refresh()
      return this.tokens!.accessToken
    }
    await this.login()
    return this.tokens!.accessToken
  }

  /**
   * Full JWT login flow.
   */
  private async login(): Promise<void> {
    // 1. Get server public key
    const verifyRes = await fetch(`${this.baseUrl}/auth/verify.json`)
    if (!verifyRes.ok) throw new Error(`Failed to get server public key: ${verifyRes.status}`)
    const verifyData = (await verifyRes.json()) as ServerVerifyResponse
    const serverKeyArmored = verifyData.body.keydata

    // 2. Read keys
    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: this.privateKeyArmored }),
      passphrase: this.passphrase,
    })
    const serverPublicKey = await openpgp.readKey({ armoredKey: serverKeyArmored })

    // 3. Build and encrypt challenge
    const challenge = JSON.stringify({
      version: '1.0.0',
      domain: this.baseUrl,
      verify_token: crypto.randomUUID(),
      verify_token_expiry: Math.floor(Date.now() / 1000) + 300,
    })

    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: challenge }),
      encryptionKeys: serverPublicKey,
      signingKeys: privateKey,
    })

    // 4. POST login
    const loginRes = await fetch(`${this.baseUrl}/auth/jwt/login.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: this.userId,
        challenge: encrypted,
      }),
    })
    if (!loginRes.ok) {
      const body = await loginRes.text()
      throw new Error(`JWT login failed (${loginRes.status}): ${body}`)
    }

    const loginData = (await loginRes.json()) as JwtLoginResponse
    this.storeTokens(loginData.body.access_token, loginData.body.refresh_token)
  }

  /**
   * Refresh access token using the refresh token.
   */
  private async refresh(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/jwt/refresh.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.tokens!.refreshToken }),
    })
    if (!res.ok) {
      // Refresh failed – fall back to full login
      this.tokens = null
      await this.login()
      return
    }
    const data = (await res.json()) as JwtLoginResponse
    this.storeTokens(data.body.access_token, this.tokens!.refreshToken)
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    // Passbolt access tokens are valid for 5 minutes by default
    this.tokens = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + 5 * 60 * 1000,
    }
  }
}
