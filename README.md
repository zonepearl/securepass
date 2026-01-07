# 🔐 WebVault: Zero-Knowledge Password Manager

WebVault is a high-security, browser-based password manager built on a **Zero-Knowledge** architecture. This means your data is encrypted locally on your device, and only you hold the key to unlock it.

---

## Table of Contents
- [Key Features](#-key-features)
- [Getting Started](#-getting-started)
- [Passkey Setup Guide](#-passkey-setup-guide)
- [Developer Documentation](#-developer-documentation)
- [Testing](#-testing)
- [TOTP Feature](#-totp-time-based-one-time-password-feature)
- [Security Improvements](#-security-improvements-log)
- [Resources](#-resources)

---

## 🌟 Key Features

### 🛡️ Zero-Knowledge Encryption
Your data is protected using **AES-GCM 256-bit** encryption. Your Master Password never leaves your browser; it is used to derive a local cryptographic key that stays in temporary memory.

- **Algorithm**: AES-GCM (Authenticated Encryption)
- **Key Derivation**: PBKDF2 with SHA-256
- **Iterations**: 100,000
- **Salt**: Unique 256-bit per-user salt

### ☝️ Passkey Unlock (WebAuthn/TouchID/FaceID)
True passwordless authentication using your device's TouchID or FaceID. This uses the hardware-backed **WebAuthn API** with encrypted password storage for seamless unlocking.

**Security Model**:
1. Master password encrypted with AES-GCM and stored locally
2. Encryption key derived from WebAuthn credential ID (unique per device)
3. TouchID/FaceID verification required to decrypt password
4. Automatic unlock without typing password
5. Password never leaves device or transmitted over network

**How It Works**:
- **Setup**: After unlocking your vault, register your passkey. The master password is encrypted using a key derived from your device's secure enclave
- **Unlock**: Touch your fingerprint sensor or use FaceID. The system verifies your identity, decrypts your password automatically, and unlocks the vault
- **Security**: Even with physical access to the device, the encrypted password cannot be decrypted without biometric verification

### 🎭 Duress (Stealth) Mode
WebVault includes a unique "Panic Password" feature. If you are forced to open your vault, entering your secondary **Duress Password** will unlock a completely separate, decoy vault containing fake data, protecting your real credentials.

### 🔐 TOTP (2FA) Support
Store and generate Time-based One-Time Passwords (TOTP) for two-factor authentication:
- RFC 6238 compliant
- 6-digit codes with 30-second validity
- Compatible with Google Authenticator, Authy, and other 2FA apps
- Live countdown timer
- Encrypted storage

### 📊 Security Audit & Entropy
The app automatically audits your passwords:
- **Entropy Check**: Warns you if a password is too simple or predictable (Shannon Entropy calculation)
- **Reuse Detection**: Identifies if you are using the same password for multiple accounts
- **Strength Labels**: Weak (<40 bits), Fair (40-59), Good (60-79), Excellent (≥80 bits)

### 🔌 Offline-First
Designed to work entirely without internet. Your data is stored in your browser's local storage, ensuring access even during network outages.

---

## 🚀 Getting Started

### Installation & Setup

1. **Clone the repository**:
```bash
git clone git@github.com:zonepearl/keepassman.git
cd keepassman
```

2. **Install dependencies**:
```bash
npm install
```

3. **Run development server**:
```bash
npm run dev
```

4. **Build for production**:
```bash
npm run build
```

5. **Preview production build**:
```bash
npm run preview
```

### First-Time Use

1. **Initialize**: Enter a strong Master Password
2. **Add Entries**: Use the "Add Entry" form to store your accounts
3. **Save**: Always click **Encrypt & Save** after making changes to persist data to your device
4. **Secure**: Use the **Security Hub** to enable Biometrics or the Duress vault

### Adding TOTP (2FA)

1. Get your TOTP secret from the service (usually shown during 2FA setup)
2. Paste the Base32 secret in the "2FA Secret (Optional)" field
3. Save your vault
4. The 6-digit code will appear in the entry card with a countdown timer

**Example TOTP Secrets** (for testing):
```
JBSWY3DPEHPK3PXP
GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
MFRGGZDFMZTWQ2LK
```

---

## 🔑 Passkey Setup Guide

### Passwordless Authentication with TouchID/FaceID

Once set up, unlock your vault with just a fingerprint or face scan—no password typing required!

### Prerequisites
- **HTTPS connection** (required for WebAuthn) or localhost
- **Compatible device** with biometric sensor:
  - Mac with Touch ID
  - iPhone/iPad with Face ID or Touch ID
  - Android device with fingerprint sensor
  - Windows Hello compatible device

### Setup Steps

1. **Unlock Your Vault**
   - Enter your master password and unlock your vault
   - The vault must be unlocked before registering a passkey

2. **Navigate to Security Hub**
   - Click the "Security Hub" button in your vault
   - Find the "Enable Biometrics" button

3. **Register Your Passkey**
   - Click "Enable Biometrics"
   - Your device will prompt for TouchID/FaceID verification
   - Authorize the credential creation
   - Success message: "✓ Passkey registered!"

4. **Test Passwordless Unlock**
   - Lock your vault (refresh page)
   - Click the fingerprint/biometric button (🔐)
   - Touch your biometric sensor
   - Vault unlocks automatically—no password needed!

### How It Works

**What Happens During Registration:**
1. WebAuthn credential created in your device's secure enclave
2. Master password encrypted with AES-GCM
3. Encryption key derived from credential ID (unique to your device)
4. Encrypted password stored locally

**What Happens During Unlock:**
1. TouchID/FaceID verification
2. Credential ID retrieved from device
3. Encryption key reconstructed
4. Password automatically decrypted and vault unlocked

### Security

- **Encrypted Storage**: Master password encrypted with AES-GCM 256-bit
- **Device-Bound**: Credential tied to specific device hardware
- **Biometric-Protected**: Cannot decrypt without your fingerprint/face
- **Zero-Knowledge**: Password never transmitted or shared
- **Automatic Cleanup**: Password cleared from memory after unlock

### Troubleshooting

**"WebAuthn not supported"**
- Ensure you're on HTTPS or localhost
- Check browser supports WebAuthn (Chrome, Safari, Firefox, Edge modern versions)

**"No passkey found"**
- Register passkey first by unlocking vault and going to Security Hub

**Passkey stops working**
- Re-register if you changed your master password
- Browser updates may require re-registration

### Important Notes

⚠️ **Always Remember Your Master Password**: Passkeys are a convenience feature. If you lose device access, you'll need your master password.

⚠️ **Device-Specific**: Each device requires separate registration. Passkeys don't sync across devices.

⚠️ **Browser-Specific**: Each browser needs its own passkey registration.

---

## 🛠️ Developer Documentation

### Internal Logic & Architecture

WebVault is a Zero-Knowledge password manager. This section outlines the security protocols and logical flows implemented within the application.

### 🔐 Cryptographic Stack

The vault relies exclusively on the native **Web Crypto API** for hardware-accelerated, secure operations.

* **Key Derivation (KDF):** Uses `PBKDF2` with `SHA-256`
* **Iterations:** 100,000
* **Salt:** Unique 256-bit `Uint8Array` per user

* **Encryption Algorithm:** `AES-GCM` (256-bit). This provides **Authenticated Encryption**, ensuring data confidentiality and integrity (detecting unauthorized tampering)

### 🧠 Primary Security Logic

#### 🎭 Duress Mode (Decoy Switching)

Authentication uses a **fallthrough decryption mechanism** to provide plausible deniability:

1. **Attempt A:** Derive key → Decrypt `encrypted_vault`
2. **Attempt B (on Failure):** Derive key → Decrypt `decoy_vault`
3. **State Management:** If Attempt B succeeds, `isDecoyMode` is set to `true`. All subsequent `SAVE` operations are routed to the decoy storage slot, keeping the primary vault hidden and untouched.

#### ☝️ Passkey Flow (WebAuthn with Encrypted Password Storage)

Passkeys provide **passwordless authentication** with secure encrypted storage:

**Registration Process:**
1. Vault must be unlocked first
2. WebAuthn credential created and registered with device's secure enclave
3. Wrapping key derived from credential ID using PBKDF2 (100,000 iterations)
4. Master password encrypted with AES-GCM using the wrapping key
5. Encrypted password stored in localStorage (`bio_wrapped_password`)
6. Only credential ID stored unencrypted (`bio_credential_id`)

**Authentication Process:**
1. User initiates biometric unlock
2. WebAuthn challenges device's secure enclave (TouchID/FaceID prompt)
3. Upon successful biometric verification, credential ID retrieved
4. Wrapping key re-derived from credential ID
5. Encrypted password decrypted automatically
6. Password auto-filled and vault unlocked
7. Password cleared from memory after unlock

**Security Properties:**
* Master password encrypted at rest with AES-GCM
* Wrapping key derived deterministically from credential ID (never stored)
* Credential ID tied to specific device hardware
* Biometric verification required to reconstruct wrapping key
* No plaintext password storage anywhere in the system

### 🛡️ Input Security & Sanitization

All inputs are passed through the enhanced `SecurityScanner` utility with comprehensive protection:

#### XSS Prevention (15+ Attack Vectors)
* **Script Tags**: Detects all variations of `<script>` tags
* **Event Handlers**: Blocks `onclick`, `onerror`, `onload`, and all DOM event attributes
* **JavaScript Protocol**: Prevents `javascript:` URL schemes
* **Data URIs**: Blocks `data:text/html` injection
* **HTML Entities**: Detects entity encoding attempts (`&#...;`)
* **SVG/Iframe Injection**: Prevents embedded content attacks
* **Object/Embed Tags**: Blocks plugin-based XSS
* **Meta Refresh**: Prevents redirect-based XSS
* **Style-Based XSS**: Blocks CSS `expression()` and `@import`
* **Link Tag Injection**: Prevents malicious stylesheet injection

#### Input Validation & Sanitization
* **Title Sanitization**: All entry titles validated and sanitized before storage
* **Control Character Removal**: Strips null bytes and control characters
* **SQL Injection Detection**: Defense-in-depth pattern matching
* **Whitespace Normalization**: Automatic trimming and cleanup

#### Duplicate Password Detection
* **Password Reuse Checking**: Warns when using same password across entries
* **User Confirmation**: Requires explicit approval to proceed with duplicate
* **Entry Listing**: Shows which entries already use the password
* **Edit Exclusion**: Ignores current entry when checking for duplicates

#### Base32 Validation for TOTP
* **Alphabet Validation**: Ensures only A-Z, 2-7, and '=' characters
* **Padding Verification**: Validates correct Base32 padding (1, 3, 4, or 6 chars)
* **Length Checking**: Enforces minimum 16-character requirement
* **Format Detection**: Clear error messages for each validation failure

#### Privacy & Security
* **Auto-Hide Passwords**: 30-second timers prevent shoulder surfing
* **Error Handling**: Secure error messages without information leakage
* **Validation Errors**: User-friendly alerts for security violations

### 🛡️ Anti-Clickjacking Implementation

**Warning:** The CSP directive `frame-ancestors` is ignored in `<meta>` tags.

To prevent Clickjacking:
1. **Production:** Deploy with the HTTP Header `Content-Security-Policy: frame-ancestors 'none';` or `X-Frame-Options: DENY`
2. **Fallback:** A JS "Frame-Buster" is included in the `<head>` to ensure the vault cannot be rendered within an `<iframe>` on a malicious domain

### 📊 Password Audit Algorithm

We evaluate password strength using the **Shannon Entropy** principle.

* **Formula:** `Entropy = Length × log₂(PoolSize)`
  * `Length` = Length of the password
  * `PoolSize` = Size of the character pool (Uppercase, Lowercase, Numbers, Symbols)

* **Enforcement:**
  * **Threshold:** Entries with entropy < 40 bits are flagged with a `badge-danger`
  * **Randomness:** `generatePassword()` utilizes `crypto.getRandomValues()` for cryptographically secure pseudorandom number generation (CSPRNG)

### 📁 Storage Schema (`localStorage`)

| Key | Format | Description |
| --- | --- | --- |
| `encrypted_vault` | JSON | Primary vault containing `{iv: Array, data: Array}` |
| `decoy_vault` | JSON | The stealth/fake vault triggered by the Duress password |
| `vault_salt` | JSON Array | Per-user salt for main vault (256-bit) |
| `decoy_salt` | JSON Array | Per-user salt for decoy vault (256-bit) |
| `bio_credential_id` | String | Base64-encoded WebAuthn credential ID |
| `bio_wrapped_password` | JSON | Encrypted master password `{iv: Array, data: Array}` |
| `bio_registered` | Boolean | UI flag to display the passkey unlock button |

### 📦 Production Build Pipeline

To protect the source code from casual inspection, we use a hardened Vite pipeline:

1. **Compilation:** `tsc` ensures type safety before bundling
2. **Minification:** `Terser` performs aggressive dead-code elimination and variable mangling
3. **Obfuscation:** Top-level variables are renamed to single characters
4. **Source Maps:** Explicitly disabled to prevent the browser from reconstructing the original `.ts` files
5. **Deployment:** Only the contents of the `/dist` folder should be served publicly

---

## 🧪 Testing

### Test Suite Overview

WebVault includes comprehensive unit tests for cryptographic operations and password utilities using **Vitest**.

### Test Statistics
- **Total Test Files**: 2
- **Total Tests**: 47
- **Pass Rate**: 100%
- **Coverage**: Core cryptographic and password functions

### Running Tests

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

### Test Files

#### 1. `src/crypto.test.ts` (21 tests)
Tests for the CryptoEngine module covering AES-GCM encryption and PBKDF2 key derivation.

**Key Derivation Tests (4 tests)**
- ✅ Should derive a CryptoKey from password and salt
- ✅ Should derive same key for same password and salt
- ✅ Should derive different keys for different passwords
- ✅ Should derive different keys for different salts

**Encryption Tests (5 tests)**
- ✅ Should encrypt data successfully
- ✅ Should produce different ciphertext each time (random IV)
- ✅ Should encrypt empty string
- ✅ Should encrypt long text (10,000 characters)
- ✅ Should encrypt special characters (Unicode, emojis)

**Decryption Tests (6 tests)**
- ✅ Should decrypt encrypted data correctly
- ✅ Should decrypt empty string
- ✅ Should decrypt special characters correctly
- ✅ Should fail to decrypt with wrong key
- ✅ Should fail to decrypt with wrong IV
- ✅ Should fail to decrypt tampered ciphertext (integrity check)

**Full Cycle Tests (3 tests)**
- ✅ Should handle JSON data correctly
- ✅ Should maintain data integrity across multiple operations
- ✅ Should work with different salts for same password

**Security Property Tests (3 tests)**
- ✅ Should use AES-GCM algorithm
- ✅ Should use 12-byte IV (recommended for AES-GCM)
- ✅ Should produce cryptographically random IVs

#### 2. `src/utils/password.test.ts` (26 tests)

Tests for password generation, entropy calculation, and strength evaluation.

**Entropy Calculation Tests (7 tests)**
- ✅ Should return 0 for empty password
- ✅ Should calculate entropy for lowercase only
- ✅ Should calculate entropy for mixed case
- ✅ Should calculate entropy for alphanumeric
- ✅ Should calculate entropy for full charset
- ✅ Should handle special characters correctly
- ✅ Should return consistent results

**Strength Label Tests (5 tests)**
- ✅ Should return "Weak" for entropy < 40 bits
- ✅ Should return "Fair" for entropy 40-59 bits
- ✅ Should return "Good" for entropy 60-79 bits
- ✅ Should return "Excellent" for entropy ≥ 80 bits
- ✅ Should handle boundary values correctly

**Password Generation Tests (8 tests)**
- ✅ Should generate password of default length (20)
- ✅ Should generate password of specified length
- ✅ Should generate different passwords each time
- ✅ Should use full character set (lowercase, uppercase, digits, symbols)
- ✅ Should only contain valid characters
- ✅ Should have high entropy (>100 bits for 20 chars)
- ✅ Should handle edge case lengths (1, 100)
- ✅ Should be cryptographically random

**Real-World Password Tests (6 tests)**
- ✅ Common weak password: "password" (weak)
- ✅ Basic password with capital and number: "Password1" (fair)
- ✅ Medium strength password: "P@ssw0rd!" (good)
- ✅ XKCD famous password: "Tr0ub4dor&3" (good)
- ✅ Long passphrase: "correcthorsebatterystaple" (excellent)
- ✅ Strong random password: "8zK$mP#2qL&9vN@4" (excellent)

### Test Configuration

```typescript
// vitest.config.ts
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

### Security Test Coverage

**Cryptographic Guarantees Tested:**
1. **Deterministic Key Derivation**: Same password + salt = same key
2. **Key Uniqueness**: Different passwords or salts produce different keys
3. **Authenticated Encryption**: Tampered ciphertext fails decryption
4. **IV Randomness**: All IVs are unique and unpredictable
5. **Data Integrity**: Multiple encrypt/decrypt cycles preserve data
6. **Vault Isolation**: Different salts prevent cross-vault decryption

**Password Security Tested:**
1. **Cryptographic Randomness**: Uses `crypto.getRandomValues()`
2. **High Entropy**: Generated passwords have >100 bits entropy
3. **Character Diversity**: All character types represented
4. **Collision Resistance**: No duplicate passwords generated
5. **Accurate Strength Assessment**: Entropy calculations match expected values

### Coverage Reports

After running `npm run coverage`, view the HTML report:
```bash
open coverage/index.html
```

**Current Coverage:**
- **crypto.ts**: 100% (all functions tested)
- **utils/password.ts**: 100% (all functions tested)
- **Excluded**: main.ts (UI logic, tested manually)

---

## 🔐 TOTP (Time-based One-Time Password) Feature

### Overview
WebVault includes full support for storing and generating TOTP (2FA) codes, allowing users to manage both passwords and two-factor authentication codes in one secure location.

### Features

#### 1. TOTP Secret Storage
- **Optional Field**: TOTP secrets are completely optional per entry
- **Base32 Validation**: Automatic validation of TOTP secret format
- **Auto-formatting**: Input field automatically converts to uppercase
- **Encrypted Storage**: TOTP secrets are encrypted with the vault (AES-GCM 256-bit)

#### 2. Live TOTP Code Generation
- **Real-time Generation**: Codes update automatically every 30 seconds
- **Visual Countdown**: Timer shows seconds remaining until next code
- **Formatted Display**: Codes displayed as "XXX XXX" for easy reading
- **Error Handling**: Invalid secrets show "Invalid Secret" instead of breaking

#### 3. Standard Compatibility
- **RFC 6238 Compliant**: Follows TOTP standard specification
- **Compatible Secrets**: Works with secrets from:
  - Google Authenticator
  - Authy
  - Microsoft Authenticator
  - 1Password
  - Any RFC 6238 compliant app

### Implementation Details

#### Code Generation Algorithm
```typescript
function generateTOTP(secret: string) {
    let totp = new OTPAuth.TOTP({
        issuer: "WebVault",
        label: "PearlYoung",
        algorithm: "SHA1",      // Standard TOTP algorithm
        digits: 6,              // 6-digit codes (standard)
        period: 30,             // 30-second validity period
        secret: OTPAuth.Secret.fromBase32(secret)
    });

    const code = totp.generate();
    const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    return { code, secondsRemaining };
}
```

#### Base32 Validation
```typescript
function isValidBase32(str: string): boolean {
    // Base32 alphabet: A-Z (uppercase) and 2-7
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(str) && str.length > 0;
}
```

### Technical Specifications

| Property | Value |
|----------|-------|
| Algorithm | SHA-1 (HMAC-SHA1) |
| Code Length | 6 digits |
| Time Step | 30 seconds |
| Format | Base32 encoding |
| Standard | RFC 6238 |
| Library | OTPAuth v9.4.1 |

### Security Considerations

#### ✅ Secure Practices
- TOTP secrets encrypted at rest
- Codes generated on-demand (not cached)
- Validation prevents injection attacks
- No network transmission of secrets

#### ⚠️ Important Notes
- **Single Point of Failure**: Storing passwords AND TOTP in same vault reduces 2FA effectiveness
- **Recommendation**: Consider keeping TOTP in separate app for true two-factor security
- **Use Case**: Best for accounts where convenience matters more than maximum security

### Storage Format

TOTP secrets are stored as part of the entry object:
```json
{
    "id": "uuid-here",
    "title": "GitHub",
    "password": "encrypted",
    "totpSecret": "JBSWY3DPEHPK3PXP"  // Optional field
}
```

The entire vault (including TOTP secrets) is encrypted with AES-GCM before storage.

---

## 🔒 Security Improvements Log

### 2026-01-08: Per-User Salt Generation

#### Problem
Previously, the application used a hardcoded salt value:
```typescript
const SALT = new Uint8Array([42, 17, 89, 4, 255, 12, 0, 33]);
```

This created a significant security vulnerability:
- If the source code was exposed, attackers could pre-compute rainbow tables for all users
- All users shared the same salt, making mass attacks more efficient
- Violated cryptographic best practices for key derivation

#### Solution
Implemented per-user salt generation:
- Each vault now generates a unique 256-bit (32-byte) cryptographically secure salt
- Main vault salt stored at `vault_salt` in localStorage
- Duress vault salt stored at `decoy_salt` in localStorage
- Salts are not secret and are stored unencrypted (this is standard practice)

#### Security Benefits
1. **Rainbow Table Prevention**: Each user has unique salt, making pre-computation attacks impractical
2. **Parallel Attack Mitigation**: Attackers must attack each vault individually
3. **Best Practice Compliance**: Follows NIST SP 800-132 guidelines for password-based key derivation
4. **Increased Entropy**: 256-bit salt provides strong randomness

#### Migration Notes

**IMPORTANT:** Existing vaults created before this update will not work!

Users with existing vaults need to:
1. Export their data (if export functionality exists)
2. Clear localStorage
3. Reinitialize vault with new master password
4. Re-import data

---

### 2026-01-08: Biometric Security Enhancement

#### Problem
Previously, biometric authentication stored the master password in Base64 encoding:
```typescript
localStorage.setItem('bio_wrapped_pwd', btoa(pwd));
```

This created critical security vulnerabilities:
- Base64 is NOT encryption - it's trivial encoding
- Master password stored in plaintext (just encoded) in localStorage
- Anyone with DevTools access could retrieve the password instantly
- Violated zero-knowledge architecture principles
- Defeated the entire purpose of password protection

#### Solution
Implemented secure biometric authentication without password storage:

**New Flow:**
1. User unlocks vault with master password
2. User enables biometrics (registers WebAuthn credential)
3. Only the credential ID is stored - NO password
4. On next login:
   - User triggers biometric authentication
   - System verifies fingerprint/FaceID via WebAuthn
   - User is prompted to enter master password
   - Vault unlocks normally with password

#### Security Benefits
1. **Zero Password Storage**: Master password never stored, even encrypted
2. **Two-Factor Approach**: Biometric (something you are) + Password (something you know)
3. **WebAuthn Security**: Uses hardware-backed authentication
4. **User Verification**: Requires `userVerification: "required"` flag
5. **True Zero-Knowledge**: Maintains zero-knowledge architecture

#### User Experience
**Before:**
- Touch fingerprint → Auto-unlock (insecure)

**After:**
- Touch fingerprint → Verified! → Enter password → Unlock (secure)

#### Why This is Better
While requiring password entry after biometric might seem less convenient:
- It's genuinely secure (old method was security theater)
- Provides real two-factor authentication
- Maintains zero-knowledge architecture
- Prevents password theft via localStorage access
- Aligns with security best practices

---

## 📚 Resources

### Documentation
- [Vitest Documentation](https://vitest.dev/)
- [happy-dom Documentation](https://github.com/capricorn86/happy-dom)
- [Web Crypto API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [WebAuthn Guide](https://webauthn.guide/)
- [OTPAuth Library](https://github.com/hectorm/otpauth)

### Security Standards
- [NIST PBKDF2 Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [RFC 6238 - TOTP Specification](https://datatracker.ietf.org/doc/html/rfc6238)
- [NIST SP 800-132](https://csrc.nist.gov/publications/detail/sp/800-132/final)

### Project
- **Repository**: [github.com/zonepearl/keepassman](https://github.com/zonepearl/keepassman)
- **License**: MIT
- **Version**: 1.0.0

---

## 📝 License

MIT License - See LICENSE file for details

---

