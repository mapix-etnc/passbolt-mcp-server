/**
 * Unit tests for ResourceHandlers.generatePassword
 *
 * Tests the password generator without any network calls or real crypto keys.
 */

import { describe, it, expect } from '@jest/globals'
import { ResourceHandlers } from '../src/handlers/resources.js'

// Minimal mocks – generatePassword does not use client, crypto, or auth
const mockClient = {} as never
const mockCrypto = {} as never
const mockAuth = {} as never

describe('ResourceHandlers.generatePassword', () => {
  const handler = new ResourceHandlers(mockClient, mockCrypto, mockAuth)

  it('generates password of requested length', () => {
    const { password } = handler.generatePassword({ length: 20, include_uppercase: true, include_numbers: true, include_symbols: false })
    expect(password).toHaveLength(20)
  })

  it('generates password with only lowercase when all flags false', () => {
    const { password } = handler.generatePassword({ length: 32, include_uppercase: false, include_numbers: false, include_symbols: false })
    expect(password).toMatch(/^[a-z]+$/)
  })

  it('includes uppercase letters when requested', () => {
    // Run multiple times to statistically guarantee uppercase presence
    const passwords = Array.from({ length: 20 }, () =>
      handler.generatePassword({ length: 30, include_uppercase: true, include_numbers: false, include_symbols: false }).password
    )
    const hasUpper = passwords.some((p) => /[A-Z]/.test(p))
    expect(hasUpper).toBe(true)
  })

  it('includes numbers when requested', () => {
    const passwords = Array.from({ length: 20 }, () =>
      handler.generatePassword({ length: 30, include_uppercase: false, include_numbers: true, include_symbols: false }).password
    )
    const hasNumber = passwords.some((p) => /[0-9]/.test(p))
    expect(hasNumber).toBe(true)
  })

  it('includes symbols when requested', () => {
    const passwords = Array.from({ length: 20 }, () =>
      handler.generatePassword({ length: 30, include_uppercase: false, include_numbers: false, include_symbols: true }).password
    )
    const hasSymbol = passwords.some((p) => /[^a-z]/.test(p))
    expect(hasSymbol).toBe(true)
  })

  it('returns string type', () => {
    const { password } = handler.generatePassword({ length: 16, include_uppercase: true, include_numbers: true, include_symbols: true })
    expect(typeof password).toBe('string')
  })

  it('generates different passwords each time (randomness)', () => {
    const a = handler.generatePassword({ length: 24, include_uppercase: true, include_numbers: true, include_symbols: false }).password
    const b = handler.generatePassword({ length: 24, include_uppercase: true, include_numbers: true, include_symbols: false }).password
    // Extremely unlikely to collide with 24 chars
    expect(a).not.toBe(b)
  })
})
