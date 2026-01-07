# Testing Documentation

## Test Suite Overview

WebVault now includes comprehensive unit tests for cryptographic operations and password utilities using **Vitest**.

### Test Statistics
- **Total Test Files**: 2
- **Total Tests**: 47
- **Pass Rate**: 100%
- **Coverage**: Core cryptographic and password functions

---

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run coverage
```

---

## Test Files

### 1. `src/crypto.test.ts` (21 tests)
Tests for the CryptoEngine module covering AES-GCM encryption and PBKDF2 key derivation.

#### Key Derivation Tests (4 tests)
- ✅ Should derive a CryptoKey from password and salt
- ✅ Should derive same key for same password and salt
- ✅ Should derive different keys for different passwords
- ✅ Should derive different keys for different salts

#### Encryption Tests (5 tests)
- ✅ Should encrypt data successfully
- ✅ Should produce different ciphertext each time (random IV)
- ✅ Should encrypt empty string
- ✅ Should encrypt long text (10,000 characters)
- ✅ Should encrypt special characters (Unicode, emojis)

#### Decryption Tests (6 tests)
- ✅ Should decrypt encrypted data correctly
- ✅ Should decrypt empty string
- ✅ Should decrypt special characters correctly
- ✅ Should fail to decrypt with wrong key
- ✅ Should fail to decrypt with wrong IV
- ✅ Should fail to decrypt tampered ciphertext (integrity check)

#### Full Cycle Tests (3 tests)
- ✅ Should handle JSON data correctly
- ✅ Should maintain data integrity across multiple operations
- ✅ Should work with different salts for same password

#### Security Property Tests (3 tests)
- ✅ Should use AES-GCM algorithm
- ✅ Should use 12-byte IV (recommended for AES-GCM)
- ✅ Should produce cryptographically random IVs

### 2. `src/utils/password.test.ts` (26 tests)

Tests for password generation, entropy calculation, and strength evaluation.

#### Entropy Calculation Tests (7 tests)
- ✅ Should return 0 for empty password
- ✅ Should calculate entropy for lowercase only
- ✅ Should calculate entropy for mixed case
- ✅ Should calculate entropy for alphanumeric
- ✅ Should calculate entropy for full charset
- ✅ Should handle special characters correctly
- ✅ Should return consistent results

#### Strength Label Tests (5 tests)
- ✅ Should return "Weak" for entropy < 40 bits
- ✅ Should return "Fair" for entropy 40-59 bits
- ✅ Should return "Good" for entropy 60-79 bits
- ✅ Should return "Excellent" for entropy ≥ 80 bits
- ✅ Should handle boundary values correctly

#### Password Generation Tests (8 tests)
- ✅ Should generate password of default length (20)
- ✅ Should generate password of specified length
- ✅ Should generate different passwords each time
- ✅ Should use full character set (lowercase, uppercase, digits, symbols)
- ✅ Should only contain valid characters
- ✅ Should have high entropy (>100 bits for 20 chars)
- ✅ Should handle edge case lengths (1, 100)
- ✅ Should be cryptographically random

#### Real-World Password Tests (6 tests)
- ✅ Common weak password: "password" (weak)
- ✅ Basic password with capital and number: "Password1" (fair)
- ✅ Medium strength password: "P@ssw0rd!" (good)
- ✅ XKCD famous password: "Tr0ub4dor&3" (good)
- ✅ Long passphrase: "correcthorsebatterystaple" (excellent)
- ✅ Strong random password: "8zK$mP#2qL&9vN@4" (excellent)

---

## Test Configuration

### `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    environment: 'happy-dom',  // Browser-like environment
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts']
    }
  }
})
```

### Key Features
- **happy-dom**: Lightweight DOM implementation for browser API tests
- **Global APIs**: `describe`, `it`, `expect` available globally
- **Coverage**: V8 coverage with HTML/JSON/text reports
- **Source Maps**: Full TypeScript support

---

## Security Test Coverage

### Cryptographic Guarantees Tested
1. **Deterministic Key Derivation**: Same password + salt = same key
2. **Key Uniqueness**: Different passwords or salts produce different keys
3. **Authenticated Encryption**: Tampered ciphertext fails decryption
4. **IV Randomness**: All IVs are unique and unpredictable
5. **Data Integrity**: Multiple encrypt/decrypt cycles preserve data
6. **Vault Isolation**: Different salts prevent cross-vault decryption

### Password Security Tested
1. **Cryptographic Randomness**: Uses `crypto.getRandomValues()`
2. **High Entropy**: Generated passwords have >100 bits entropy
3. **Character Diversity**: All character types represented
4. **Collision Resistance**: No duplicate passwords generated
5. **Accurate Strength Assessment**: Entropy calculations match expected values

---

## Test Examples

### Running Specific Tests
```bash
# Run only crypto tests
npx vitest src/crypto.test.ts

# Run only password tests
npx vitest src/utils/password.test.ts

# Run tests matching pattern
npx vitest -t "encrypt"
```

### Watch Mode
```bash
# Start watch mode (re-runs on file changes)
npm test
```

### UI Mode
```bash
# Open Vitest UI in browser
npm run test:ui
```

---

## Coverage Reports

After running `npm run coverage`, view the HTML report:
```bash
open coverage/index.html
```

### Current Coverage
- **crypto.ts**: 100% (all functions tested)
- **utils/password.ts**: 100% (all functions tested)
- **Excluded**: main.ts (UI logic, tested manually)

---

## Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test:run
      - run: npm run coverage
```

---

## Future Test Improvements

### Planned Additions
- [ ] Integration tests for full vault lifecycle
- [ ] Browser compatibility tests (Firefox, Safari, Edge)
- [ ] Performance benchmarks for crypto operations
- [ ] Fuzz testing for crypto edge cases
- [ ] E2E tests with Playwright
- [ ] TOTP generation tests
- [ ] Security scanner tests
- [ ] Breach check API mocking

### Test Metrics to Track
- [ ] Code coverage (target: >90%)
- [ ] Test execution time
- [ ] Crypto operation performance
- [ ] Memory usage during encryption

---

## Debugging Tests

### Failed Test Investigation
```bash
# Run with verbose output
npx vitest --reporter=verbose

# Run single test
npx vitest -t "should encrypt data successfully"

# Debug with Node inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

### Common Issues

**Issue**: "Cannot find module './crypto'"
**Solution**: Add `.js` extension: `import { CryptoEngine } from './crypto.js'`

**Issue**: "key is not extractable"
**Solution**: Don't export keys; test via encrypt/decrypt instead

**Issue**: "crypto is not defined"
**Solution**: Use `happy-dom` environment in vitest.config.ts

---

## Best Practices

### Writing New Tests
1. **Use descriptive test names**: "should encrypt data successfully" not "test1"
2. **Test one thing**: Each test should verify a single behavior
3. **Use arrange-act-assert**: Setup → Execute → Verify
4. **Test edge cases**: Empty strings, very long inputs, special characters
5. **Test security properties**: Uniqueness, randomness, integrity
6. **Clean up resources**: Clear intervals, close connections

### Test Structure
```typescript
describe('Feature', () => {
  describe('subFeature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = doSomething(input)

      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [happy-dom Documentation](https://github.com/capricorn86/happy-dom)
- [Web Crypto API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [NIST PBKDF2 Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
