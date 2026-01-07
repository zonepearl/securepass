import { describe, it, expect, beforeAll } from 'vitest'
import { CryptoEngine } from './crypto.js'

describe('CryptoEngine', () => {
  // Setup crypto polyfill for testing environment
  beforeAll(() => {
    if (!global.crypto) {
      const { webcrypto } = require('crypto')
      global.crypto = webcrypto as Crypto
    }
  })

  describe('deriveKey', () => {
    it('should derive a CryptoKey from password and salt', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)

      const key = await CryptoEngine.deriveKey(password, salt)

      expect(key).toBeDefined()
      expect(key.type).toBe('secret')
      expect(key.algorithm.name).toBe('AES-GCM')
    })

    it('should derive same key for same password and salt', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32])

      const key1 = await CryptoEngine.deriveKey(password, salt)
      const key2 = await CryptoEngine.deriveKey(password, salt)

      // Keys should be the same - test by encrypting with one and decrypting with the other
      const testData = 'test data'
      const { ciphertext, iv } = await CryptoEngine.encrypt(testData, key1)
      const decrypted = await CryptoEngine.decrypt(ciphertext, key2, iv)

      expect(decrypted).toBe(testData)
    })

    it('should derive different keys for different passwords', async () => {
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)

      const key1 = await CryptoEngine.deriveKey('password1', salt)
      const key2 = await CryptoEngine.deriveKey('password2', salt)

      // Test that key2 cannot decrypt data encrypted with key1
      const testData = 'test data'
      const { ciphertext, iv } = await CryptoEngine.encrypt(testData, key1)

      await expect(CryptoEngine.decrypt(ciphertext, key2, iv)).rejects.toThrow()
    })

    it('should derive different keys for different salts', async () => {
      const password = 'testPassword123'
      const salt1 = new Uint8Array(32)
      const salt2 = new Uint8Array(32)
      crypto.getRandomValues(salt1)
      crypto.getRandomValues(salt2)

      const key1 = await CryptoEngine.deriveKey(password, salt1)
      const key2 = await CryptoEngine.deriveKey(password, salt2)

      // Test that key2 cannot decrypt data encrypted with key1
      const testData = 'test data'
      const { ciphertext, iv } = await CryptoEngine.encrypt(testData, key1)

      await expect(CryptoEngine.decrypt(ciphertext, key2, iv)).rejects.toThrow()
    })
  })

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const plaintext = 'Hello, World!'
      const result = await CryptoEngine.encrypt(plaintext, key)

      expect(result.ciphertext).toBeDefined()
      expect(result.iv).toBeDefined()
      expect(result.iv).toHaveLength(12)
      expect(result.ciphertext.byteLength).toBeGreaterThan(0)
    })

    it('should produce different ciphertext each time (due to random IV)', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const plaintext = 'Hello, World!'
      const result1 = await CryptoEngine.encrypt(plaintext, key)
      const result2 = await CryptoEngine.encrypt(plaintext, key)

      expect(new Uint8Array(result1.ciphertext)).not.toEqual(new Uint8Array(result2.ciphertext))
      expect(result1.iv).not.toEqual(result2.iv)
    })

    it('should encrypt empty string', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const result = await CryptoEngine.encrypt('', key)

      expect(result.ciphertext).toBeDefined()
      expect(result.iv).toBeDefined()
    })

    it('should encrypt long text', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const longText = 'A'.repeat(10000)
      const result = await CryptoEngine.encrypt(longText, key)

      expect(result.ciphertext).toBeDefined()
      expect(result.ciphertext.byteLength).toBeGreaterThan(longText.length)
    })

    it('should encrypt special characters', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const specialText = '🔐 Password: "P@$$w0rd!" €£¥'
      const result = await CryptoEngine.encrypt(specialText, key)

      expect(result.ciphertext).toBeDefined()
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted data correctly', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const plaintext = 'Hello, World!'
      const { ciphertext, iv } = await CryptoEngine.encrypt(plaintext, key)
      const decrypted = await CryptoEngine.decrypt(ciphertext, key, iv)

      expect(decrypted).toBe(plaintext)
    })

    it('should decrypt empty string', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const { ciphertext, iv } = await CryptoEngine.encrypt('', key)
      const decrypted = await CryptoEngine.decrypt(ciphertext, key, iv)

      expect(decrypted).toBe('')
    })

    it('should decrypt special characters correctly', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const specialText = '🔐 Password: "P@$$w0rd!" €£¥'
      const { ciphertext, iv } = await CryptoEngine.encrypt(specialText, key)
      const decrypted = await CryptoEngine.decrypt(ciphertext, key, iv)

      expect(decrypted).toBe(specialText)
    })

    it('should fail to decrypt with wrong key', async () => {
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key1 = await CryptoEngine.deriveKey('password1', salt)
      const key2 = await CryptoEngine.deriveKey('password2', salt)

      const plaintext = 'Hello, World!'
      const { ciphertext, iv } = await CryptoEngine.encrypt(plaintext, key1)

      await expect(CryptoEngine.decrypt(ciphertext, key2, iv)).rejects.toThrow()
    })

    it('should fail to decrypt with wrong IV', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const plaintext = 'Hello, World!'
      const { ciphertext } = await CryptoEngine.encrypt(plaintext, key)
      const wrongIV = new Uint8Array(12)
      crypto.getRandomValues(wrongIV)

      await expect(CryptoEngine.decrypt(ciphertext, key, wrongIV)).rejects.toThrow()
    })

    it('should fail to decrypt tampered ciphertext', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const plaintext = 'Hello, World!'
      const { ciphertext, iv } = await CryptoEngine.encrypt(plaintext, key)

      // Tamper with ciphertext
      const tamperedCiphertext = new Uint8Array(ciphertext)
      tamperedCiphertext[0] ^= 1

      await expect(CryptoEngine.decrypt(tamperedCiphertext.buffer, key, iv)).rejects.toThrow()
    })
  })

  describe('Full encryption/decryption cycle', () => {
    it('should handle JSON data correctly', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const data = {
        entries: [
          { id: '1', title: 'GitHub', password: 'gh_token_123' },
          { id: '2', title: 'Gmail', password: 'email@pass' }
        ]
      }

      const jsonString = JSON.stringify(data)
      const { ciphertext, iv } = await CryptoEngine.encrypt(jsonString, key)
      const decrypted = await CryptoEngine.decrypt(ciphertext, key, iv)
      const parsedData = JSON.parse(decrypted)

      expect(parsedData).toEqual(data)
    })

    it('should maintain data integrity across multiple operations', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const originalData = 'Sensitive data that must remain intact'

      // Encrypt and decrypt multiple times
      let { ciphertext, iv } = await CryptoEngine.encrypt(originalData, key)
      let decrypted = await CryptoEngine.decrypt(ciphertext, key, iv)
      expect(decrypted).toBe(originalData)

      // Second cycle
      ;({ ciphertext, iv } = await CryptoEngine.encrypt(decrypted, key))
      decrypted = await CryptoEngine.decrypt(ciphertext, key, iv)
      expect(decrypted).toBe(originalData)
    })

    it('should work with different salt for same password', async () => {
      const password = 'testPassword123'
      const plaintext = 'Hello, World!'

      // First vault
      const salt1 = new Uint8Array(32)
      crypto.getRandomValues(salt1)
      const key1 = await CryptoEngine.deriveKey(password, salt1)
      const { ciphertext: cipher1, iv: iv1 } = await CryptoEngine.encrypt(plaintext, key1)

      // Second vault (different salt)
      const salt2 = new Uint8Array(32)
      crypto.getRandomValues(salt2)
      const key2 = await CryptoEngine.deriveKey(password, salt2)
      const { ciphertext: cipher2, iv: iv2 } = await CryptoEngine.encrypt(plaintext, key2)

      // Both should decrypt correctly with their own keys
      const decrypted1 = await CryptoEngine.decrypt(cipher1, key1, iv1)
      const decrypted2 = await CryptoEngine.decrypt(cipher2, key2, iv2)

      expect(decrypted1).toBe(plaintext)
      expect(decrypted2).toBe(plaintext)

      // But not with each other's keys
      await expect(CryptoEngine.decrypt(cipher1, key2, iv1)).rejects.toThrow()
      await expect(CryptoEngine.decrypt(cipher2, key1, iv2)).rejects.toThrow()
    })
  })

  describe('Security properties', () => {
    it('should use AES-GCM algorithm', () => {
      expect(CryptoEngine.ALGO).toBe('AES-GCM')
    })

    it('should use 12-byte IV (recommended for AES-GCM)', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      const { iv } = await CryptoEngine.encrypt('test', key)

      expect(iv).toHaveLength(12)
    })

    it('should produce cryptographically random IVs', async () => {
      const password = 'testPassword123'
      const salt = new Uint8Array(32)
      crypto.getRandomValues(salt)
      const key = await CryptoEngine.deriveKey(password, salt)

      // Generate multiple IVs and check they're all unique
      const ivs = await Promise.all(
        Array.from({ length: 100 }, () => CryptoEngine.encrypt('test', key))
      )

      const ivStrings = ivs.map(({ iv }) => Array.from(iv).join(','))
      const uniqueIvs = new Set(ivStrings)

      expect(uniqueIvs.size).toBe(100) // All IVs should be unique
    })
  })
})
