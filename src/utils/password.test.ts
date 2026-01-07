import { describe, it, expect } from 'vitest'
import { calculateEntropy, getStrengthLabel, generatePassword } from './password.js'

describe('Password Utilities', () => {
  describe('calculateEntropy', () => {
    it('should return 0 for empty password', () => {
      expect(calculateEntropy('')).toBe(0)
    })

    it('should calculate entropy for lowercase only', () => {
      // lowercase only: 26 characters
      // "abc" = 3 * log2(26) ≈ 3 * 4.7 ≈ 14.1
      const entropy = calculateEntropy('abc')
      expect(entropy).toBeCloseTo(14.1, 1)
    })

    it('should calculate entropy for mixed case', () => {
      // uppercase + lowercase: 52 characters
      // "AbC" = 3 * log2(52) ≈ 3 * 5.7 ≈ 17.1
      const entropy = calculateEntropy('AbC')
      expect(entropy).toBeCloseTo(17.1, 1)
    })

    it('should calculate entropy for alphanumeric', () => {
      // uppercase + lowercase + digits: 62 characters
      // "Abc123" = 6 * log2(62) ≈ 6 * 5.95 ≈ 35.7
      const entropy = calculateEntropy('Abc123')
      expect(entropy).toBeCloseTo(35.7, 1)
    })

    it('should calculate entropy for full charset', () => {
      // uppercase + lowercase + digits + symbols: 95 characters
      // "Abc123!@#" = 9 * log2(95) ≈ 9 * 6.57 ≈ 59.1
      const entropy = calculateEntropy('Abc123!@#')
      expect(entropy).toBeCloseTo(59.1, 1)
    })

    it('should handle special characters correctly', () => {
      const password = 'P@ssw0rd!'
      const entropy = calculateEntropy(password)
      // Should include all character types
      expect(entropy).toBeGreaterThan(50)
    })

    it('should return consistent results', () => {
      const password = 'TestPassword123!'
      const entropy1 = calculateEntropy(password)
      const entropy2 = calculateEntropy(password)
      expect(entropy1).toBe(entropy2)
    })
  })

  describe('getStrengthLabel', () => {
    it('should return Weak for entropy < 40', () => {
      const result = getStrengthLabel(30)
      expect(result.label).toBe('Weak')
      expect(result.color).toBe('#ef4444')
    })

    it('should return Fair for entropy 40-59', () => {
      const result = getStrengthLabel(50)
      expect(result.label).toBe('Fair')
      expect(result.color).toBe('#f59e0b')
    })

    it('should return Good for entropy 60-79', () => {
      const result = getStrengthLabel(70)
      expect(result.label).toBe('Good')
      expect(result.color).toBe('#10b981')
    })

    it('should return Excellent for entropy >= 80', () => {
      const result = getStrengthLabel(90)
      expect(result.label).toBe('Excellent')
      expect(result.color).toBe('#3b82f6')
    })

    it('should handle boundary values correctly', () => {
      expect(getStrengthLabel(39.9).label).toBe('Weak')
      expect(getStrengthLabel(40).label).toBe('Fair')
      expect(getStrengthLabel(59.9).label).toBe('Fair')
      expect(getStrengthLabel(60).label).toBe('Good')
      expect(getStrengthLabel(79.9).label).toBe('Good')
      expect(getStrengthLabel(80).label).toBe('Excellent')
    })
  })

  describe('generatePassword', () => {
    it('should generate password of default length (20)', () => {
      const password = generatePassword()
      expect(password).toHaveLength(20)
    })

    it('should generate password of specified length', () => {
      const password = generatePassword(32)
      expect(password).toHaveLength(32)
    })

    it('should generate different passwords each time', () => {
      const password1 = generatePassword(20)
      const password2 = generatePassword(20)
      expect(password1).not.toBe(password2)
    })

    it('should use full character set', () => {
      // Generate multiple passwords and check they use various character types
      const passwords = Array.from({ length: 10 }, () => generatePassword(50))
      const combined = passwords.join('')

      expect(/[a-z]/.test(combined)).toBe(true) // lowercase
      expect(/[A-Z]/.test(combined)).toBe(true) // uppercase
      expect(/[0-9]/.test(combined)).toBe(true) // digits
      expect(/[!@#$%^&*()_+~`|}{[\]:;?><,./-=]/.test(combined)).toBe(true) // symbols
    })

    it('should only contain valid characters', () => {
      const password = generatePassword(100)
      // Charset: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=
      const validCharset = /^[a-zA-Z0-9!@#$%^&*()_+~`|}{[\]:;?><,.\/-=]+$/
      expect(validCharset.test(password)).toBe(true)
    })

    it('should have high entropy', () => {
      const password = generatePassword(20)
      const entropy = calculateEntropy(password)
      // 20 characters from full charset should have ~130 bits entropy
      expect(entropy).toBeGreaterThan(100)
    })

    it('should handle edge case lengths', () => {
      expect(generatePassword(1)).toHaveLength(1)
      expect(generatePassword(100)).toHaveLength(100)
    })

    it('should be cryptographically random', () => {
      // Generate many passwords and check distribution
      const passwords = Array.from({ length: 100 }, () => generatePassword(1))
      const uniqueChars = new Set(passwords)

      // Should have good variety (not perfect, but reasonable)
      expect(uniqueChars.size).toBeGreaterThan(10)
    })
  })

  describe('Real-world password examples', () => {
    const testCases = [
      { password: 'password', expectedWeak: true, description: 'common weak password' },
      { password: 'Password1', expectedWeak: false, description: 'basic password with capital and number' }, // entropy ~47
      { password: 'P@ssw0rd!', expectedWeak: false, description: 'medium strength password' },
      { password: 'Tr0ub4dor&3', expectedWeak: false, description: 'XKCD famous password' },
      { password: 'correcthorsebatterystaple', expectedWeak: false, description: 'long passphrase' },
      { password: '8zK$mP#2qL&9vN@4', expectedWeak: false, description: 'strong random password' }
    ]

    testCases.forEach(({ password, expectedWeak, description }) => {
      it(`should correctly evaluate: ${description}`, () => {
        const entropy = calculateEntropy(password)
        const isWeak = entropy < 40
        expect(isWeak).toBe(expectedWeak)
      })
    })
  })
})
