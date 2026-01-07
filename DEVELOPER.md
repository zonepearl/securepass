
---

# 🛠️ Developer Documentation: Internal Logic & Architecture

WebVault is a Zero-Knowledge password manager. This document outlines the security protocols and logical flows implemented within the application.

## 🔐 1. Cryptographic Stack

The vault relies exclusively on the native **Web Crypto API** for hardware-accelerated, secure operations.

* **Key Derivation (KDF):** Uses `PBKDF2` with `SHA-256`.
* **Iterations:** 100,000.
* **Salt:** Fixed `Uint8Array`.


* **Encryption Algorithm:** `AES-GCM` (256-bit). This provides **Authenticated Encryption**, ensuring data confidentiality and integrity (detecting unauthorized tampering).

---

## 🧠 2. Primary Security Logic

### 🎭 Duress Mode (Decoy Switching)

Authentication uses a **fallthrough decryption mechanism** to provide plausible deniability:

1. **Attempt A:** Derive key  Decrypt `encrypted_vault`.
2. **Attempt B (on Failure):** Derive key  Decrypt `decoy_vault`.
3. **State Management:** If Attempt B succeeds, `isDecoyMode` is set to `true`. All subsequent `SAVE` operations are routed to the decoy storage slot, keeping the primary vault hidden and untouched.

### ☝️ Biometric Flow (WebAuthn)

Biometrics act as a **Key Wrapper** for the Master Password:

* **Registration:** The Master Password is Base64 encoded and stored as `bio_wrapped_pwd` alongside a hardware-generated `bio_credential_id`.
* **Authentication:** Upon a successful hardware challenge (Fingerprint/FaceID), the browser releases the stored credential, which the app uses to auto-fill the standard authentication flow.

---

## 🛡️ 3. Input Security & Sanitization

All inputs are passed through the `SecurityScanner` utility before reaching the encryption engine or the DOM.

* **XSS Prevention:** Uses `textContent` mapping and `SecurityScanner.escapeHTML()` to neutralize malicious scripts before rendering.
* **Injection Detection:** Active Regex scanning blocks SQL injection patterns (e.g., `' OR 1=1`) and script tags during `Add/Update` cycles.
* **Privacy (Auto-Hide):** Localized 30-second timers manage the visibility state of passwords in the DOM to prevent "shoulder surfing."

## 🛡️4.  Anti-Clickjacking Implementation
**Warning:** The CSP directive `frame-ancestors` is ignored in `<meta>` tags. 

To prevent Clickjacking:
1. **Production:** Deploy with the HTTP Header `Content-Security-Policy: frame-ancestors 'none';` or `X-Frame-Options: DENY`.
2. **Fallback:** A JS "Frame-Buster" is included in the `<head>` to ensure the vault cannot be rendered within an `<iframe>` on a malicious domain.

---

## 📊 5. Password Audit Algorithm

We evaluate password strength using the **Shannon Entropy** principle.

* **Formula:** 
*  = Length of the password.
*  = Size of the character pool (Uppercase, Lowercase, Numbers, Symbols).


* **Enforcement:**
* **Threshold:** Entries with  bits are flagged with a `badge-danger`.
* **Randomness:** `generatePassword()` utilizes `crypto.getRandomValues()` for cryptographically secure pseudorandom number generation (CSPRNG).



---

## 📁 6. Storage Schema (`localStorage`)

| Key | Format | Description |
| --- | --- | --- |
| `encrypted_vault` | JSON | Primary vault containing `{iv: Array, data: Array}`. |
| `decoy_vault` | JSON | The stealth/fake vault triggered by the Duress password. |
| `bio_wrapped_pwd` | Base64 | Encoded Master Password used by the biometric bridge. |
| `bio_credential_id` | String | Unique ID for the WebAuthn hardware key. |
| `bio_registered` | Boolean | UI flag to display the Biometric unlock button. |

---

## 📦 Production Build Pipeline
To protect the source code from casual inspection, we use a hardened Vite pipeline:

1. **Compilation:** `tsc` ensures type safety before bundling.
2. **Minification:** `Terser` performs aggressive dead-code elimination and variable mangling.
3. **Obfuscation:** Top-level variables are renamed to single characters.
4. **Source Maps:** Explicitly disabled to prevent the browser from reconstructing the original `.ts` files.
5. **Deployment:** Only the contents of the `/dist` folder should be served publicly.

**Next Step:** Would you like me to create a **Security Audit Checklist** for this project to help you identify any remaining vulnerabilities before deployment?