# SecurePass — Engineer Roadmap & Complete Skill Set

**Version:** 2.1.0 | **Architecture:** Zero-Knowledge, Rust/Wasm + TypeScript

A reference for engineers joining or extending SecurePass. The first half is the product roadmap (what to build next and when). The second half — [Complete Skill Set Required](#complete-skill-set-required) — is a standalone deep-dive into every domain concept, cryptographic primitive, language feature, and tooling concept the project touches.

**Quick navigation**: If you are assessing your readiness rather than planning work, jump directly to [Complete Skill Set Required](#complete-skill-set-required).

---

## Product Roadmap

### Current State (v2.1.0)

| Area | Status |
|------|--------|
| Argon2id key derivation (Rust/Wasm) | ✅ Production |
| AES-256-GCM authenticated encryption (Rust/Wasm) | ✅ Production |
| Master password vault (localStorage) | ✅ Production |
| Password generator — standard / Mac-style / passphrase | ✅ Production |
| TOTP / 2FA (RFC 6238, Rust) | ✅ Production |
| Password history (last 5, sliding window) | ✅ Production |
| Biometric unlock — WebAuthn + Argon2id key wrap | ✅ Production |
| Duress mode — decoy vault with fallthrough auth | ✅ Production |
| Breach detection — k-anonymity HIBP check | ✅ Production |
| Auto-lock — configurable inactivity timeout | ✅ Production |
| Backup / restore — encrypted JSON export + import | ✅ Production |
| Security dashboard — entropy + breach analytics | ✅ Production |
| XSS prevention — SecurityScanner (15+ patterns) | ✅ Production |
| 13 Web Components, glassmorphism UI, dark/light theme | ✅ Production |
| 70+ tests, Vitest, 100% pass rate | ✅ Production |
| Browser extension (Chrome, Firefox, Safari, Edge) | ⏳ Critical |
| Cross-device sync — File System API → E2E cloud | ⏳ Critical |
| Import — 1Password / Bitwarden / LastPass / Chrome CSV | ⏳ High |
| Mobile PWA — offline capable | ⏳ High |
| Hardware key — YubiKey / FIDO2 as 2FA then passwordless | ⏳ High |
| Secure password sharing — expiring links | ⏳ High |
| Emergency access — recovery codes, trusted contacts | ⏳ Medium |
| Custom fields — per-entry arbitrary metadata | ⏳ Medium |
| File attachments — IndexedDB + encrypted cloud | ⏳ Medium |
| CLI tool | ⏳ Low |
| Desktop app — Tauri | ⏳ Low |
| Enterprise — SAML / LDAP / SCIM | ⏳ Low |

### Upcoming Phase Detail

#### Phase 3 — Browser Extension (Critical)

The highest-impact next feature. Requires a new Manifest V3 sub-project.

Key engineering challenges:
- Auto-fill: `content.js` detects `<input type="password">` → injects credentials via DOM or `input.value` + dispatching `input`/`change` events
- Secure messaging: popup → background service worker → content script, with `sender.id` validation on every message
- Wasm in service workers: `wasm-pack --target bundler` output; service workers cannot use `type: "module"` in all browsers — test carefully
- Vault access: background worker holds the decrypted `CryptoBridge`; content scripts must not have access to it directly
- Session persistence: service workers sleep after ~30s; vault must survive the sleep/wake cycle without re-prompting the user

#### Phase 4 — Cross-Device Sync

Three-stage plan:
1. **File System API** (`window.showSaveFilePicker`) — sync to a local `.spvault` file; no server
2. **E2E encrypted cloud** — user-supplied storage (Dropbox API, Google Drive) with client-side AES-GCM before upload; server never sees plaintext
3. **Self-hosted Docker** — zero-knowledge relay server; receives and stores only ciphertext

---

## Complete Skill Set Required

This section covers every concept an engineer needs to work on SecurePass — from cryptographic primitives to WASM memory models to Vitest mocking patterns. Each table has a **Depth** column:

- **Fluent** — you need this every day; must be second nature
- **Aware** — you need to understand the concept and read code using it; not required to write from scratch

---

### 1. Cryptography — Domain Knowledge

This is the most important section. SecurePass's entire value proposition is correct cryptography. An engineer who doesn't understand these concepts will accidentally break security.

#### 1.1 Foundational Concepts

| Concept | Depth | Why It Matters for SecurePass |
|---------|-------|-------------------------------|
| **Symmetric vs asymmetric encryption** | Fluent | SecurePass uses only symmetric (AES). Asymmetric (RSA, ECC) is not currently used but will appear in secure sharing (Phase). Know the difference |
| **Block cipher vs stream cipher** | Aware | AES is a block cipher; in GCM mode it behaves like a stream cipher (CTR under the hood). Helps debug IV reuse issues |
| **Key vs password** | Fluent | A password is human-memorable entropy (typically weak). A *key* is a fixed-length high-entropy value derived from the password. KDFs bridge the gap — this is Argon2id's job |
| **Entropy** | Fluent | Measured in bits: `H = L × log2(R)` where L = length, R = charset size. `entropy-calculator` in `password.ts` — you must understand what this formula means to evaluate password strength claims |
| **Randomness: PRNG vs CSPRNG** | Fluent | `Math.random()` is a PRNG — never use it for cryptography. `crypto.getRandomValues()` (Web Crypto) and Rust's `rand::thread_rng()` (hardware-backed) are CSPRNGs. SecurePass generates all secrets in Rust |
| **Nonce / IV (Initialization Vector)** | Fluent | AES-GCM requires a 12-byte IV. **Never reuse an IV with the same key.** Reuse makes ciphertext malleable. SecurePass generates a fresh random IV for every encryption operation |
| **Authentication tag** | Fluent | AES-GCM produces a 16-byte auth tag appended to ciphertext. Decryption verifies it — any tampering causes a hard error, not corrupt plaintext. This is what "authenticated encryption" means |
| **AEAD (Authenticated Encryption with Associated Data)** | Fluent | AES-GCM is an AEAD cipher. It provides confidentiality + integrity + authenticity in one operation. Never use raw AES-CBC for a password manager — CBC provides confidentiality only |
| **Salt** | Fluent | Random value added to a password before hashing/KDF. Prevents rainbow table attacks — identical passwords produce different keys. The `vault_salt` in localStorage is public and non-secret; its randomness is what matters |
| **Key stretching** | Fluent | KDFs are deliberately slow (time) and/or large (memory) to make brute-force expensive. The iteration count / memory parameter must be tuned to the threat model |

#### 1.2 Key Derivation Functions (KDFs)

| Concept | Depth | Notes |
|---------|-------|-------|
| **PBKDF2** (RFC 2898) | Aware | Predecessor — removed from SecurePass. PBKDF2-HMAC-SHA256 with 100K iterations: GPU can run ~1 billion iterations/sec; 100K iterations = milliseconds of resistance. Know why it was replaced |
| **bcrypt** | Aware | Memory-intensive for password hashing; max 72-byte input; not suited for 32-byte key output. Not used in SecurePass |
| **scrypt** | Aware | Memory-hard; predecessor to Argon2. Not used but conceptually adjacent |
| **Argon2id** | Fluent | **The KDF used in SecurePass.** Three variants: Argon2d (GPU resistant), Argon2i (side-channel resistant), Argon2id (hybrid — best for password hashing). Parameters: `m_cost` (memory in KiB), `t_cost` (iterations), `p_cost` (parallelism), `output_len` (32 bytes in SecurePass). Memory-hard: attacker must allocate the full `m_cost` of RAM per guess — GPU attack fails because GPUs have limited per-core VRAM |
| **Argon2id parameters in SecurePass** | Fluent | Read `src-wasm/src/lib.rs` — know what `m_cost`, `t_cost`, `p_cost` are set to and whether they meet OWASP recommendations (m≥47104 KiB, t≥1, p=1 minimum) |
| **Why KDFs ≠ hash functions** | Fluent | SHA-256 hashes a password in nanoseconds; Argon2id takes hundreds of milliseconds by design. Using a plain hash for password storage is a critical vulnerability |

#### 1.3 AES-256-GCM In Depth

| Concept | Depth | Notes |
|---------|-------|-------|
| **AES key sizes** | Fluent | 128, 192, 256 bits. SecurePass uses 256-bit keys (32 bytes output from Argon2id) |
| **GCM mode (Galois/Counter Mode)** | Fluent | CTR mode for confidentiality + GHASH for authentication. Produces ciphertext of same length as plaintext + 16-byte tag |
| **IV size for GCM** | Fluent | 12 bytes (96 bits) is the standard for AES-GCM. Using non-standard sizes requires an additional GHASH operation and changes security properties |
| **IV uniqueness requirement** | Fluent | With a 12-byte random IV and a single key, the birthday paradox gives collision probability ~1/2³² after ~4 billion encryptions. For a password manager (hundreds of entries), random IVs are safe |
| **Decryption failure = tampering** | Fluent | If the auth tag doesn't match, `aes-gcm` crate returns `Err`. In SecurePass this distinguishes "wrong password" from "corrupted data" — important for the duress fallthrough logic |
| **Encrypted payload format** | Fluent | SecurePass stores `{iv: number[], data: number[]}` in localStorage. The `data` is ciphertext + appended GCM auth tag |

#### 1.4 Password Security Concepts

| Concept | Depth | Notes |
|---------|-------|-------|
| **GPU cracking attacks** | Fluent | Offline attack: attacker copies the encrypted vault, runs Argon2id attempts locally with GPU. Argon2id's memory requirement makes this 1000× slower than PBKDF2 |
| **Rainbow tables** | Fluent | Precomputed hash → plaintext lookup tables. Salting defeats them — even if attacker has a rainbow table for SHA-256, the salt makes every hash unique |
| **Credential stuffing** | Aware | Attacker uses breached username/password pairs from one site to try others. Breach detection (HIBP) addresses the user's exposure; unique password generation prevents stuffing |
| **Password entropy formula** | Fluent | `H = L × log2(charset_size)`. 12-char mixed: L=12, R=94 → H≈78 bits. 4-word passphrase from 7776-word list: L=4, R=7776 → H≈51 bits. Understand why length matters more than complexity |
| **Duplicate password risk** | Fluent | `SecurityScanner.findDuplicatePasswords()` — one breach exposes all sites using the same password. This detection is a core UX safety feature |
| **Passphrase security** | Aware | Diceware-style passphrases: memorable but lower entropy per character than random. SecurePass uses a 4-word list — understand the entropy tradeoff |

#### 1.5 Zero-Knowledge Architecture

| Concept | Depth | Notes |
|---------|-------|-------|
| **Zero-knowledge (ZK) in password managers** | Fluent | Not to be confused with ZK proofs (cryptographic). In the password manager context, ZK means: the service provider never has access to the plaintext vault or master password. SecurePass is client-side only — there is no service provider |
| **End-to-End Encryption (E2EE)** | Fluent | Encryption/decryption happens on the user's device. The encrypted blob is the only thing that ever leaves (in Phase 4 sync). The server is a dumb encrypted-blob store |
| **Trust model** | Fluent | In a ZK design: trust is entirely in the client code and the cryptographic primitives. If the JS code is compromised (XSS, supply chain), ZK is broken. This is why CSP, XSS prevention, and integrity hashes matter |
| **Master password never transmitted** | Fluent | No network request ever carries the master password or the derived key. Even `console.log` of the master password is a security violation — this is why Terser strips console.log in production |

#### 1.6 WebAuthn / FIDO2 / Passkeys

| Concept | Depth | Notes |
|---------|-------|-------|
| **WebAuthn overview** | Fluent | W3C standard for password-less / second-factor auth using public-key cryptography. Three parties: relying party (the app), authenticator (device biometric sensor or hardware key), browser API |
| **Credential creation (`create`)** | Fluent | `navigator.credentials.create({publicKey: ...})` — authenticator generates a key pair; sends back `{credentialId, attestationObject, clientDataJSON}`. Only the public key and credentialId are stored |
| **Credential assertion (`get`)** | Fluent | `navigator.credentials.get({publicKey: ...})` — authenticator signs a challenge; app verifies with the stored public key. Proves possession of the authenticator |
| **How SecurePass uses WebAuthn** | Fluent | SecurePass does not use WebAuthn for standard relying-party auth. Instead: `credentialId → Argon2id → wrapping key → AES-GCM wrap(master password)`. The credential ID is used as a deterministic KDF input, not as a signing key. This is a novel design — understand it carefully |
| **`bio_wrapped_password` in localStorage** | Fluent | The master password is encrypted with the biometric wrapping key. Biometric auth recovers the wrapping key, decrypts the master password, then proceeds with normal Argon2id unlock |
| **Platform vs cross-platform authenticators** | Aware | Platform: built-in TouchID/FaceID. Cross-platform: YubiKey (Phase roadmap). Current implementation targets platform authenticators |
| **Attestation vs assertion** | Aware | Attestation (creation): proves authenticator properties. Assertion (usage): proves user presence. SecurePass only needs assertion for unlock |
| **Credential ID as KDF input security** | Fluent | The credentialId is not a secret (stored in localStorage as `bio_credential_id`). Security comes from WebAuthn proving biometric presence before returning the credentialId to JS. Argon2id then derives the wrapping key |

#### 1.7 TOTP — Time-Based One-Time Passwords (RFC 6238)

| Concept | Depth | Notes |
|---------|-------|-------|
| **HOTP (RFC 4226)** | Aware | Hash-based OTP: `HOTP(K, C) = truncate(HMAC-SHA1(K, C))` where C is a counter. Base for TOTP |
| **TOTP (RFC 6238)** | Fluent | Time-based OTP: C = `floor(currentTime / timestep)` where timestep = 30 seconds. 6-digit code rotates every 30s |
| **Base32 secret encoding** | Fluent | TOTP secrets are encoded in Base32 (32-character alphabet). User scans a QR code which encodes `otpauth://totp/...?secret=BASE32SECRET`. Rust's `totp-rs` crate decodes this |
| **Time synchronization tolerance** | Aware | `totp-rs` allows ±1 window by default (accepts codes from 30s before and after). Important for devices with drifted clocks |
| **TOTP in SecurePass** | Fluent | Stored as `totpSecret: string` (Base32) in the vault entry. The `get_totp_code(secret)` Wasm function generates the current code on demand — nothing is persisted except the secret |

#### 1.8 Breach Detection — k-Anonymity with HIBP

| Concept | Depth | Notes |
|---------|-------|-------|
| **Have I Been Pwned (HIBP)** | Fluent | Database of 12+ billion breached credentials. API: query by password hash prefix, get matching suffix list. Never send the full hash |
| **k-anonymity model** | Fluent | Privacy-preserving query: `SHA1(password)` → send first 5 hex characters → HIBP returns all SHA1 hashes starting with that prefix. Client checks if the full hash is in the response. HIBP never sees your password or its full hash |
| **SHA-1 for HIBP** | Aware | SHA-1 is cryptographically broken (collision attacks) but used here only as a lookup key in a public database — not for security. The k-anonymity model means the secrecy of the hash is not required |
| **Implementation** | Fluent | `src/utils/breach-check.ts`: `crypto.subtle.digest('SHA-1', encoded)` → hex prefix → `https://api.pwnedpasswords.com/range/{prefix}` → check suffix. Only network call SecurePass makes |

#### 1.9 Browser Security Model

| Concept | Depth | Notes |
|---------|-------|-------|
| **Same-origin policy (SOP)** | Fluent | JavaScript on `origin-A.com` cannot read `localStorage` or make credentialed requests to `origin-B.com`. SecurePass's localStorage is isolated to its origin |
| **Content Security Policy (CSP)** | Fluent | HTTP header / meta tag that restricts what resources a page can load and execute. Every directive in SecurePass's CSP has a specific threat it mitigates — know each one |
| **`script-src 'self' 'wasm-unsafe-eval'`** | Fluent | `'self'`: only scripts from the same origin. `'wasm-unsafe-eval'`: required for Wasm instantiation (Wasm compiles bytecode at runtime, which browsers treat as a form of eval). Without this, `WebAssembly.instantiate()` is blocked |
| **`connect-src 'self' https://api.pwnedpasswords.com`** | Fluent | Restricts `fetch()` / XHR destinations. Without `api.pwnedpasswords.com`, the breach check fetch would be blocked by CSP |
| **`frame-ancestors 'none'`** | Fluent | Prevents SecurePass from being loaded in an iframe (clickjacking defense). Only effective as an HTTP header — `<meta>` tag is ignored for this directive |
| **XSS (Cross-Site Scripting)** | Fluent | Attacker injects a `<script>` tag or event handler into user-controlled content that renders in the browser. If successful, the script can read `localStorage`, capture keystrokes, and exfiltrate the encrypted vault. `SecurityScanner` defends against this |
| **Stored XSS vs reflected XSS** | Fluent | Stored: injected into a persisted field (e.g., entry title stored in vault). When rendered to DOM, executes. Reflected: in URL parameters (less relevant for a SPA). SecurePass's sanitization focuses on stored XSS via vault entry fields |
| **Clickjacking** | Aware | Attacker frames SecurePass in an invisible iframe and tricks the user into clicking buttons. `frame-ancestors 'none'` + `X-Frame-Options: DENY` defend against this |
| **`textContent` vs `innerHTML`** | Fluent | `element.innerHTML = userInput` is an XSS vector — the browser parses and executes HTML. `element.textContent = userInput` treats the value as literal text — always use `textContent` for user-controlled data |

#### 1.10 Memory Safety & Side Channels

| Concept | Depth | Notes |
|---------|-------|-------|
| **Memory scraping attacks** | Fluent | An attacker with memory access (malware, cold boot, browser exploit) can scan heap memory for cryptographic key material. JS strings are GC-managed and may persist in memory after use |
| **Wasm linear memory isolation** | Fluent | Wasm has its own contiguous byte array (`WebAssembly.Memory`). JS can read it (via `buffer`), but the Wasm runtime controls it. The master key lives only in Wasm memory — it never crosses into the JS heap as a JS string or object |
| **Zeroize pattern** | Fluent | `Zeroize` / `ZeroizeOnDrop` Rust traits overwrite memory with zeros before deallocation. Prevents DRAM remanence (residual charge after deallocation can be read by memory forensics tools). Every `CryptoBridge` instance zeroes its key on `drop()` |
| **Timing attacks** | Aware | An attacker measures how long an operation takes to infer secret information (e.g., a character-by-character string comparison short-circuits on mismatch, leaking the number of matching characters). Constant-time comparison is required for auth checks. `aes-gcm`'s tag verification is constant-time |
| **Side-channel attacks (general)** | Aware | Class of attacks that observe indirect outputs (timing, power consumption, electromagnetic emissions, cache behaviour) rather than the algorithm itself. Argon2id was designed with cache-timing resistance (Argon2i variant focuses on this; Argon2id is the hybrid) |

#### 1.11 Duress / Coercion Resistance

| Concept | Depth | Notes |
|---------|-------|-------|
| **Duress / rubber-hose attack** | Fluent | Scenario: attacker physically coerces the user into revealing the master password. A decoy vault provides plausible deniability |
| **Decoy vault implementation** | Fluent | Two separate encrypted blobs: `encrypted_vault` (real) and `decoy_vault` (fake). Two separate Argon2id salts. Authentication tries the real vault first; on failure, tries the decoy vault — success enters `isDecoyMode = true` and all writes go to the decoy slot |
| **Security property** | Fluent | The attacker cannot distinguish "wrong password" from "entering duress mode" because both cases show a successfully unlocked vault. The decoy vault must be maintained with plausible content |

---

### 2. WebAssembly — In Depth

WebAssembly is the runtime that makes SecurePass's security model possible. Understanding it deeply is required for anyone modifying `src-wasm/`.

#### 2.1 Wasm Conceptual Model

| Concept | Depth | Notes |
|---------|-------|-------|
| **What Wasm is** | Fluent | A binary instruction format for a stack-based virtual machine. Runs in the browser at near-native speed. Designed as a compilation target (not written directly). Not JavaScript — it's a separate VM in the same browser process |
| **Linear memory** | Fluent | A contiguous, resizable ArrayBuffer. Wasm code reads/writes it directly; JS can access it through `wasmInstance.exports.memory.buffer` but cannot inspect Wasm's register-level state. This is the isolation property SecurePass relies on |
| **Wasm module sections** | Aware | A `.wasm` file contains sections: type definitions, imports (functions the host provides), exports (functions the host can call), function bodies, globals, data, etc. `wasm-bindgen` generates the correct structure automatically |
| **JS-Wasm boundary** | Fluent | Passing data across the boundary requires serialisation. Primitive types (i32, f64) pass directly. Strings and byte arrays must be copied via linear memory. `wasm-bindgen` automates this but you must understand what it does to debug type errors |
| **Wasm is sandboxed** | Fluent | Wasm cannot make system calls directly. Every OS interaction (network, storage, console) goes through imported JS functions. This is why Wasm code can call `console.log` — it's an import provided by the browser's Wasm runtime |

#### 2.2 Rust → Wasm Compilation Pipeline

| Concept | Depth | Notes |
|---------|-------|-------|
| **Target: `wasm32-unknown-unknown`** | Fluent | The Rust compilation target. "Unknown" OS and ABI — no std library system calls available. No `std::fs`, no `std::net`. Only `core` and `alloc` crates work without feature flags |
| **`wasm-pack build --target web`** | Fluent | Produces ES module output: `.wasm` binary + `.js` glue that uses `WebAssembly.instantiate()`. Used in SecurePass because Vite imports the output as an ES module |
| **`wasm-pack build --target bundler`** | Aware | Output designed for webpack/Rollup; uses `import` for the `.wasm` file. Alternative to `--target web` — may be needed for the browser extension (Phase 3) |
| **`wasm-pack build --dev`** | Aware | Debug mode: no optimizations, includes debug info, enables `console_error_panic_hook`. Use during Rust development only — debug Wasm is ~10× larger |
| **`#[wasm_bindgen]` attribute** | Fluent | Marks Rust functions and structs for JS export. `wasm-bindgen` reads these at compile time and generates the JS glue code. Apply to: `struct` (for JS class), `impl` blocks (for methods), standalone `fn` (for free functions) |
| **`JsValue` type** | Fluent | `wasm_bindgen::JsValue` — a handle to a JS value (any type). Used when the type isn't statically known. `serde_wasm_bindgen::from_value::<T>(js_value)` deserialises it to a Rust type |
| **`serde-wasm-bindgen`** | Fluent | Enables passing JS objects (like `PasswordOptions`) to Rust structs without manual field extraction. `#[derive(Deserialize)]` + `serde_wasm_bindgen::from_value()`. Know the difference from `serde_json` — this serialises to/from `JsValue`, not a JSON string |
| **Vec<u8> ↔ Uint8Array mapping** | Fluent | `Vec<u8>` return values from `#[wasm_bindgen]` functions become `Uint8Array` in JS. `Uint8Array` inputs become `&[u8]` or `Vec<u8>`. Understand the copy semantics — each crossing allocates a new buffer |
| **Wasm binary optimizations** | Fluent | In `Cargo.toml` `[profile.release]`: `opt-level = "z"` (size, not speed), `lto = true` (link-time optimization — dead code elimination across crates), `codegen-units = 1` (better LTO), `panic = "abort"` (removes panic unwind machinery, ~50KB savings) |
| **`wasm-bindgen` JS class output** | Fluent | `CryptoBridge` in Rust becomes a JS class. JS must call the `.free()` method on the JS object when done (or wrap in a `FinalizationRegistry`). If `free()` is not called, the Wasm allocation leaks |

#### 2.3 Wasm + CSP

| Concept | Depth | Notes |
|---------|-------|-------|
| **`'wasm-unsafe-eval'`** | Fluent | `WebAssembly.instantiate()` compiles bytecode at runtime — browsers classify this as a form of eval. CSP `script-src` must include `'wasm-unsafe-eval'` or Wasm loading is blocked. This is why the SecurePass CSP includes it |
| **`'unsafe-eval'` vs `'wasm-unsafe-eval'`** | Fluent | `'wasm-unsafe-eval'` allows only Wasm instantiation, not `eval()` or `new Function()`. Always prefer `'wasm-unsafe-eval'` over `'unsafe-eval'` when only Wasm is needed |
| **Streaming instantiation** | Aware | `WebAssembly.instantiateStreaming(fetch(url))` is faster than `instantiate(buffer)` because it compiles while downloading. `vite`'s Wasm plugin handles this automatically |

---

### 3. Rust — Language Concepts

You do not need to be a Rust expert to work on SecurePass's Wasm layer, but you need more than the basics because `lib.rs` uses several intermediate patterns.

#### 3.1 Core Language

| Concept | Depth | Notes |
|---------|-------|-------|
| **Ownership and move semantics** | Fluent | A value has exactly one owner. Assigning moves ownership — the original binding is invalid. Compiler enforces this at compile time. No garbage collector |
| **Borrowing — shared (`&T`) and mutable (`&mut T`)** | Fluent | Multiple `&T` references (read-only) OR one `&mut T` reference (read-write) — never both simultaneously. Prevents data races at compile time |
| **Lifetimes (`'a`)** | Aware | Annotations that tell the compiler how long a reference is valid. Mostly inferred; explicit annotations needed in function signatures when the compiler can't determine them. You mainly need to read lifetime errors, not write complex annotations |
| **`Option<T>` and `Result<T, E>`** | Fluent | No null in Rust. `Option<T>` = `Some(T)` or `None`. `Result<T, E>` = `Ok(T)` or `Err(E)`. The `?` operator propagates `Err` up the call stack (like `try/catch` without unwinding) |
| **Pattern matching (`match`, `if let`)** | Fluent | Exhaustive matching on enums — compiler errors if a case is missed. Critical for `Result`/`Option` handling and for `ParsedRule`-style discriminated enums |
| **`struct` and `impl`** | Fluent | `struct CryptoBridge { master_key: Vec<u8> }` + `impl CryptoBridge { fn new(...) -> Self { ... } }`. Methods live in `impl` blocks |
| **Enums with data** | Fluent | `enum PasswordMode { Standard(StandardOpts), MacStyle, Passphrase }` — Rust enums are algebraic data types, each variant can carry different data |
| **Traits** | Aware | Like interfaces. `impl Zeroize for CryptoBridge` — implement a trait's methods for your type. Derive macros (`#[derive(Serialize)]`) auto-implement common traits |
| **Closures** | Fluent | `|x| x + 1` — anonymous functions capturing their environment. Used extensively with iterators: `.map(|c| c.to_uppercase())` |
| **Iterators and combinators** | Fluent | `.filter()`, `.map()`, `.collect::<Vec<_>>()`, `.take()`, `.chain()`. The password generator's character pool assembly uses iterator chaining |
| **`String` vs `&str`** | Fluent | `String` is owned, heap-allocated, growable. `&str` is a borrowed reference to a string slice (can point into a `String`, a literal, or elsewhere). Function parameters usually take `&str`; return values usually return `String` |
| **`Vec<u8>` vs slices `&[u8]`** | Fluent | `Vec<u8>` is owned, resizable. `&[u8]` is a borrowed slice. AES-GCM ciphertext is `Vec<u8>`; function inputs from JS are `&[u8]` |

#### 3.2 Crates Used in SecurePass

| Crate | Depth | What to Know |
|-------|-------|-------------|
| **`argon2` v0.5.3** | Fluent | `Argon2::default()` uses Argon2id variant. `Argon2::hash_password_into(password, salt, output)` fills `output` with derived key bytes. The `zeroize` cargo feature ensures the internal state is zeroed on drop |
| **`aes-gcm` v0.10.3** | Fluent | `Aes256Gcm::new(key)` creates cipher. `.encrypt(nonce, plaintext)` returns `Vec<u8>` (ciphertext + tag). `.decrypt(nonce, ciphertext)` returns `Result<Vec<u8>>`. Nonce must be `GenericArray<u8, U12>` (12 bytes) |
| **`zeroize` v1.8.1** | Fluent | `#[derive(Zeroize, ZeroizeOnDrop)]` on a struct zeroes all fields when the value is dropped. Critical for `CryptoBridge` — prevents master key from persisting in Wasm memory after the bridge is freed |
| **`rand` v0.8.5** | Fluent | `rand::thread_rng()` — a cryptographically secure RNG seeded from the OS entropy source. `.gen_range(0..n)` for uniform distribution. Used in password generator — never substitute `Math.random()` |
| **`totp-rs` v5.6.0** | Aware | `TOTP::new(...)` creates a TOTP instance. `.generate_current()` returns the current 6-digit code. Takes the Base32-encoded secret as input |
| **`base64` v0.22.1** | Aware | `base64::engine::general_purpose::STANDARD.encode(bytes)` and `.decode(string)`. Used for encoding binary data (IVs, salts, credential IDs) for JSON serialisation |
| **`serde` + `serde_json`** | Fluent | `#[derive(Serialize, Deserialize)]` generates JSON serialisation code. `serde_json::to_string(&value)` and `from_str::<T>(json)`. Used for password history JSON and `PasswordOptions` struct |
| **`serde-wasm-bindgen` v0.6.5** | Fluent | `serde_wasm_bindgen::from_value::<T>(js_val)` — deserialise a `JsValue` (JS object from the browser) into a Rust struct with `#[derive(Deserialize)]`. Different from `serde_json` — works directly with JS object representations, not JSON strings |
| **`wasm-bindgen` v0.2.92** | Fluent | The glue framework. `#[wasm_bindgen]` on structs creates JS classes. `#[wasm_bindgen(constructor)]` marks the constructor. `JsValue` and `js_sys` for JS interop. `console_log!` macro for debugging |

#### 3.3 Cargo and Build

| Concept | Depth | Notes |
|---------|-------|-------|
| **`Cargo.toml` structure** | Fluent | `[package]`, `[lib]`, `[dependencies]`, `[dev-dependencies]`, `[profile.release]`. `crate-type = ["cdylib"]` for Wasm (dynamic library) |
| **Feature flags** | Aware | `zeroize = { version = "...", features = ["zeroize"] }` — enables a crate's optional behaviour. The `argon2` crate's `zeroize` feature enables automatic zeroization |
| **`cargo test`** | Fluent | Runs `#[test]` functions inside `#[cfg(test)]` modules. For Wasm-targeting code, some tests need `--target x86_64-unknown-linux-gnu` because `wasm32-unknown-unknown` can't run natively |
| **`cargo build --release`** | Fluent | Applies `[profile.release]` optimizations. Always use for the `.wasm` binary that ships |

---

### 4. TypeScript — Project-Specific Depth

#### 4.1 Web Components API

| Concept | Depth | Notes |
|---------|-------|-------|
| **`HTMLElement` extension** | Fluent | `class VaultTable extends HTMLElement { ... }` — all 13 components extend `HTMLElement` directly (via `BaseComponent`) |
| **`customElements.define('vault-table', VaultTable)`** | Fluent | Registers the custom element. Once registered, `<vault-table>` in HTML instantiates the class. Registration happens in `src/components/index.ts` |
| **Lifecycle callbacks** | Fluent | `connectedCallback()` — fires when element is inserted into DOM (equivalent of `componentDidMount`). `disconnectedCallback()` — fires on removal (for cleanup). `attributeChangedCallback()` — fires when observed attributes change |
| **`observedAttributes`** | Aware | `static get observedAttributes() { return ['disabled'] }` — opt-in to attribute change callbacks |
| **`this.innerHTML` vs `this.render()`** | Fluent | SecurePass uses `innerHTML` for initial render (because there's no user data at that point) then updates with `textContent` for data. Know when each is acceptable |
| **Custom events** | Fluent | `this.dispatchEvent(new CustomEvent('save-entry', { detail: entry, bubbles: true }))` — components communicate by dispatching events up the DOM tree. `main.ts` listens at the document level |
| **Shadow DOM** | Aware | SecurePass does NOT use Shadow DOM (open DOM for accessibility). Understanding why it was avoided helps when evaluating whether to introduce it for the extension |

#### 4.2 Service Pattern and State

| Concept | Depth | Notes |
|---------|-------|-------|
| **Singleton pattern** | Fluent | `VaultState.getInstance()` — one instance, accessible globally. Used for shared mutable state across components |
| **Pub/sub with listeners** | Fluent | `subscribe(listener: () => void): () => void` — register a callback; returns an unsubscribe function. `notify()` calls all registered listeners. This is how components react to state changes |
| **Static service methods** | Fluent | `WasmCryptoService.encrypt(bridge, plaintext, iv)` — all methods are static. The service is a namespace, not a stateful object. This keeps Wasm calls testable and mockable |
| **Async Wasm initialisation** | Fluent | `WasmCryptoService.init()` must be awaited before any Wasm call. The `init()` function calls `initWasm()` (generated by wasm-pack), which fetches and compiles the `.wasm` binary. Calling Wasm before `init()` throws a "Wasm not initialised" error |

#### 4.3 Strict TypeScript Patterns

| Concept | Depth | Notes |
|---------|-------|-------|
| **Strict null checks** | Fluent | `localStorage.getItem('key')` returns `string \| null`. Must handle `null` before use. `?.` and `??` are idiomatic |
| **DOM element typing** | Fluent | `document.querySelector('#input') as HTMLInputElement` — cast only after verifying the element exists. Use `?.` access for nullable queries |
| **`Uint8Array` in TypeScript** | Fluent | Wasm functions return `Uint8Array`. `Array.from(uint8)` converts to `number[]` for JSON serialisation. `new Uint8Array(array)` reconstructs from `number[]`. Know the difference between `Uint8Array` (fixed buffer) and `number[]` (growable JS array) |
| **Type-safe custom events** | Aware | `new CustomEvent<VaultEntry>('save-entry', { detail: entry })` — the generic type parameter makes `event.detail` type-safe |

---

### 5. JavaScript — Runtime Depth

#### 5.1 Web APIs Used in SecurePass

| API | Depth | Usage |
|-----|-------|-------|
| **Web Crypto API — `crypto.getRandomValues()`** | Fluent | Fills a `TypedArray` with CSPRNG bytes. Used for generating IVs and salts. Never substitute `Math.random()` |
| **Web Crypto API — `crypto.subtle.digest('SHA-1', data)`** | Fluent | Async hash computation. Used in HIBP breach check to compute the SHA-1 of the password. Returns `ArrayBuffer` |
| **`WebAuthn` — `navigator.credentials.create()`** | Fluent | Registers a new passkey. `publicKey.challenge` must be a random buffer. Response contains `credentialId` and `attestationObject` |
| **`WebAuthn` — `navigator.credentials.get()`** | Fluent | Asserts an existing passkey. Returns the `credentialId` (used as Argon2id input in SecurePass) |
| **`localStorage`** | Fluent | Synchronous key-value store. 5–10MB limit. `setItem`, `getItem`, `removeItem`. Data persists across browser sessions. Accessible to any JS on the same origin — this is why everything is encrypted before storage |
| **`Blob` + `URL.createObjectURL()`** | Aware | Creating downloadable files for backup export. `new Blob([json], {type: 'application/json'})` → `URL.createObjectURL(blob)` → auto-click an `<a download>` element |
| **`FileReader`** | Aware | Reading the content of a file selected via `<input type="file">`. `reader.readAsText(file)` → `reader.onload` callback. Used in backup import |
| **`Clipboard API` — `navigator.clipboard.writeText()`** | Aware | Async clipboard write. Requires user gesture (click). Falls back to `document.execCommand('copy')` for older browsers |
| **`CustomEvent`** | Fluent | `new CustomEvent(type, { detail, bubbles, composed })`. `bubbles: true` allows it to propagate to parent elements. `composed: true` crosses Shadow DOM boundaries (not relevant here but important to know) |

#### 5.2 Event Loop

| Concept | Depth | Notes |
|---------|-------|-------|
| **Microtask queue (Promise callbacks)** | Fluent | `Promise.then` callbacks run before the next macrotask. Auto-save after vault update uses a Promise chain — it completes before the next rendering frame |
| **Macrotask queue (setTimeout, setInterval)** | Fluent | `AutoLockService` uses `setInterval` for inactivity checking. `setTimeout(fn, 0)` defers to after the current task finishes |
| **`async/await` execution model** | Fluent | `await` suspends the current function and yields the thread. The Wasm init, encryption, and WebAuthn calls are all async — must `await` or chain `.then()` |

---

### 6. Build Tooling

#### 6.1 Vite

| Concept | Depth | Notes |
|---------|-------|-------|
| **Dev server with HMR** | Fluent | `npm run dev` starts Vite's dev server with Hot Module Replacement. TypeScript changes reflect instantly. Wasm changes require `npm run build:wasm` then server restart |
| **Wasm plugin / asset handling** | Fluent | Vite treats `.wasm` files as assets by default. `vite.config.ts` must configure `optimizeDeps` and the Wasm import mode. `?init` suffix in imports (`import init from './pkg/securepass_wasm.js?init'`) — know this pattern |
| **Production build pipeline** | Fluent | `tsc --noEmit` (type check) → `vite build` (bundle + minify). Output in `dist/`. Content-hash filenames for cache busting |
| **Terser configuration** | Fluent | `build.minify: 'terser'` + `terserOptions`: `drop_console: true` (strips console.log), `drop_debugger: true`, `toplevel: true` (aggressively mangle top-level names), `comments: false`, no sourcemaps. Know why each option is set for a security-sensitive app |
| **`assetsInlineLimit`** | Aware | Files below this size (bytes) are inlined as base64. Important for Wasm — set to `0` to prevent Vite from inlining the `.wasm` binary |

#### 6.2 wasm-pack

| Concept | Depth | Notes |
|---------|-------|-------|
| **Install** | Fluent | `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf \| sh` or `cargo install wasm-pack` |
| **`--out-dir ../src/pkg`** | Fluent | Output goes to `src/pkg/`. Never manually edit files in this directory — they are regenerated on every `build:wasm` |
| **`--scope`** | Aware | For publishing to npm as `@scope/package-name`. Not currently used |
| **Incremental builds** | Aware | wasm-pack rebuilds only what changed. But `src/pkg/` files may have timestamps updated even if content is unchanged — be careful with CI caching |

#### 6.3 Vitest

| Concept | Depth | Notes |
|---------|-------|-------|
| **`describe` / `it` / `expect`** | Fluent | Same API as Jest — Vitest is API-compatible. Test files colocated with source (`*.test.ts` in same directory) |
| **`beforeAll` for Wasm init** | Fluent | `beforeAll(async () => { await WasmCryptoService.init(); })` — Wasm must be initialised before any crypto test runs. Forgetting this is the most common test setup error |
| **`happy-dom` environment** | Fluent | Vitest uses `happy-dom` (configured in `vitest.config.ts`) instead of `jsdom` for DOM simulation. `happy-dom` is faster and supports more modern APIs including `crypto.subtle` |
| **`vi.fn()` and `vi.spyOn()`** | Aware | Vitest's mock functions. Used to mock `localStorage.getItem/setItem` in storage tests |
| **Coverage** | Aware | `npm run coverage` → Vitest + v8 coverage provider. Reports branch/line/function coverage. |

---

### 7. Skill Acquisition Order (Recommended)

For an engineer new to SecurePass, study concepts in this order — each row builds on the previous:

| Order | What to Learn | Why First |
|-------|--------------|-----------|
| 1 | Cryptography fundamentals: entropy, symmetric vs asymmetric, hash vs KDF, salt | Everything else builds on this vocabulary |
| 2 | AES-256-GCM: AEAD, IV, auth tag, why unauthenticated encryption is dangerous | The encryption primitive used everywhere |
| 3 | Argon2id: memory-hard KDF, why PBKDF2 was replaced, parameters | Master key derivation is the vault's first line of defence |
| 4 | Zero-knowledge architecture: what it means, trust model, why console.log is a security violation | Shapes every architectural decision |
| 5 | TypeScript: async/await, interfaces, `Uint8Array`, Web Components lifecycle | Primary language for all UI and orchestration code |
| 6 | Wasm conceptual model: linear memory isolation, JS-Wasm boundary, string/byte passing | Required to understand why Rust is used and what security property it provides |
| 7 | Rust basics: ownership, `Result`/`Option`, structs, iterators | Required to read and modify `lib.rs` |
| 8 | `wasm-bindgen`: `#[wasm_bindgen]`, `JsValue`, `serde-wasm-bindgen`, Vec<u8> ↔ Uint8Array | The bridge layer between Rust and TypeScript |
| 9 | Rust crates: `argon2`, `aes-gcm`, `zeroize`, `rand`, `totp-rs` | Each crate implements one cryptographic primitive — read its documentation |
| 10 | WebAuthn / FIDO2: credential creation, assertion, how SecurePass uses credentialId as KDF input | Biometric unlock is a novel construction — needs careful understanding |
| 11 | Browser security: CSP directives, XSS vectors, `textContent` vs `innerHTML`, `frame-ancestors` | Defending the client side |
| 12 | TOTP / HIBP / breach detection: RFC 6238, k-anonymity | Supporting security features |
| 13 | Vite + wasm-pack build pipeline, Terser security options | Build and ship securely |
| 14 | Vitest: `beforeAll` Wasm init, `happy-dom`, `vi.fn()` mocking | Writing and maintaining the test suite |
| 15 | Advanced: timing attacks, memory forensics, Zeroize internals, Argon2id parameter tuning | Required for security review or hardening work |

---

## Useful References

| Resource | Topic |
|----------|-------|
| [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | Argon2id parameters, KDF comparison |
| [RFC 9106 — Argon2](https://www.rfc-editor.org/rfc/rfc9106) | Authoritative Argon2id specification |
| [AES-GCM NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) | AES-GCM mode specification |
| [WebAuthn Level 2 Spec](https://www.w3.org/TR/webauthn-2/) | Full WebAuthn specification |
| [FIDO2 Overview](https://fidoalliance.org/fido2/) | FIDO2 / Passkeys overview |
| [RFC 6238 — TOTP](https://www.rfc-editor.org/rfc/rfc6238) | Time-based OTP specification |
| [Have I Been Pwned API v3](https://haveibeenpwned.com/API/v3#PwnedPasswords) | k-anonymity breach check API |
| [Rust Book](https://doc.rust-lang.org/book/) | Full Rust language reference |
| [wasm-bindgen docs](https://rustwasm.github.io/wasm-bindgen/) | wasm-bindgen reference |
| [wasm-pack docs](https://rustwasm.github.io/wasm-pack/) | wasm-pack build tool |
| [Rustwasm Book](https://rustwasm.github.io/docs/book/) | Rust + Wasm end-to-end tutorial |
| [Web Crypto API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) | `crypto.subtle` API reference |
| [argon2 crate](https://docs.rs/argon2/latest/argon2/) | Rust argon2 crate docs |
| [aes-gcm crate](https://docs.rs/aes-gcm/latest/aes_gcm/) | Rust aes-gcm crate docs |
| [zeroize crate](https://docs.rs/zeroize/latest/zeroize/) | Rust zeroize crate docs |
| [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) | XSS defence patterns |
| [MDN CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) | Every CSP directive explained |
| [Vite docs](https://vitejs.dev/guide/) | Vite configuration and Wasm handling |
| [Vitest docs](https://vitest.dev/) | Test runner reference |
