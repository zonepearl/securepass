# Implementation Plan

Detailed guide for every item in [TODO.md](./TODO.md). Each entry covers the approach, which files to touch, key decisions, and what to watch out for.

Items are grouped into phases in the order they should be tackled — some depend on others being done first.

---

## Phase 1 — Low-effort, high-value fixes

These touch a small number of files, can be done independently, and address real gaps in the current code.

---

### 1.1 Clipboard auto-clear

**Goal:** Clear the clipboard 30 seconds after any password copy so a copied secret doesn't linger.

**Approach:**

Find every place `navigator.clipboard.writeText()` is called (currently in `src/utils/clipboard.ts`). After the write succeeds, schedule a clear and store the timeout ID so a second copy cancels the first:

```typescript
// src/utils/clipboard.ts
let clearTimer: ReturnType<typeof setTimeout> | null = null;

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    navigator.clipboard.writeText('');
    clearTimer = null;
  }, 30_000);
}
```

**Files:** `src/utils/clipboard.ts`, any component that calls clipboard directly.

**Gotcha:** `navigator.clipboard.writeText('')` requires the page to be focused and the `clipboard-write` permission. If the user has switched tabs, the clear call may be silently rejected — that is acceptable behaviour.

---

### 1.2 Lock on tab visibility change

**Goal:** Lock the vault when the browser tab is hidden (user switches tabs or minimises).

**Approach:**

Add a `visibilitychange` listener in `main.ts` alongside the existing `lock-vault` listener. Dispatch the same `lock-vault` event so the existing lock path handles everything:

```typescript
// src/main.ts — add near the other document event listeners
document.addEventListener('visibilitychange', () => {
  if (document.hidden && vaultState.isUnlocked()) {
    document.dispatchEvent(new CustomEvent('lock-vault'));
  }
});
```

`VaultState` does not currently expose an `isUnlocked()` method. Add one that checks whether `cryptoBridge` is set:

```typescript
// src/state/VaultState.ts
isUnlocked(): boolean {
  return this.cryptoBridge !== null;
}
```

**Files:** `src/main.ts`, `src/state/VaultState.ts`.

**Decision:** Should the lock fire immediately on hide, or only after N seconds? Immediate is simpler and safer. A delay adds complexity (another timer) for marginal UX gain. Start with immediate.

---

### 1.3 Document Argon2id parameters

**Goal:** Make the Argon2id parameters explicit in the code with a comment that justifies the values against OWASP minimums.

**Approach:**

`lib.rs` currently calls `Argon2::default()`, which uses the library defaults. Find what those are, evaluate them against OWASP (m≥47104 KiB, t≥1, p=1), and either confirm or raise them. Then switch from `default()` to explicit construction so the parameters are visible in code:

```rust
// src-wasm/src/lib.rs
use argon2::{Argon2, Algorithm, Version, Params};

fn new_internal(password: &str, salt: &[u8]) -> Result<CryptoBridge, String> {
    let mut master_key = [0u8; 32];

    // Argon2id parameters — reviewed against OWASP (2024):
    //   m_cost: 65536 KiB (64 MB) — OWASP min is 47104 KiB
    //   t_cost: 3 iterations
    //   p_cost: 1 lane
    // These values target ~500ms on a mid-range CPU. Adjust m_cost down
    // only if the extension's service worker environment has memory limits.
    let params = Params::new(65536, 3, 1, Some(32))
        .map_err(|e| format!("Argon2 params error: {}", e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    argon2.hash_password_into(password.as_bytes(), salt, &mut master_key)
        .map_err(|e| format!("Argon2 error: {}", e))?;

    Ok(CryptoBridge { master_key })
}
```

**Files:** `src-wasm/src/lib.rs`.

**After changing:** run `npm run build:wasm` and `cargo test` in `src-wasm/`. The key derivation tests should still pass. Measure unlock time in the browser to confirm the new parameters are acceptable.

**Note:** `Argon2::default()` in the `argon2` crate v0.5 uses m=19456 KiB, t=2, p=1 — below the OWASP recommendation for m. This is the most important thing to fix here.

---

### 1.4 Component error boundaries

**Goal:** Prevent an unhandled error inside one component from crashing the whole app.

**Approach:**

Wrap the body of `connectedCallback()` in every component with try/catch. The right place is `BaseComponent`:

```typescript
// src/components/BaseComponent.ts
export abstract class BaseComponent extends HTMLElement {
  connectedCallback(): void {
    try {
      this.render();
      this.bindEvents();
    } catch (error) {
      console.error(`[${this.tagName}] render failed:`, error);
      this.innerHTML = `<p class="component-error">Failed to load component.</p>`;
    }
  }

  protected abstract render(): void;
  protected bindEvents(): void {}
}
```

Each component's `connectedCallback` already calls `render()` and `bindEvents()` — centralising the try/catch in `BaseComponent` means every component gets the guard without touching 13 files.

**Files:** `src/components/BaseComponent.ts`.

**Gotcha:** Some components may override `connectedCallback` directly rather than using `render()`. Check each one — if they do, add the try/catch to the override as well.

---

### 1.5 Remove `any` from `WasmCryptoService`

**Goal:** Replace `as any` in `generatePassword` with the proper type from the generated `.d.ts`.

**Current state:**

```typescript
// src/services/WasmCryptoService.ts:52
} as any);
```

**Approach:**

The generated `src/pkg/securepass_wasm.d.ts` already defines `PasswordOptions`. Import it:

```typescript
import init, { CryptoBridge, derive_bio_key, wrap_password, unwrap_password, PasswordOptions } from '../pkg/securepass_wasm.js';

// then in generatePassword:
static generatePassword(bridge: CryptoBridge, length: number, useUppercase: boolean, useNumbers: boolean, useSymbols: boolean): string {
  const opts: PasswordOptions = { length, use_uppercase: useUppercase, use_numbers: useNumbers, use_symbols: useSymbols };
  return bridge.generate_password(opts);
}
```

**Files:** `src/services/WasmCryptoService.ts`.

**Note:** Run `npx tsc --noEmit` after to confirm the types are correct across all call sites.

---

### 1.6 Vault format versioning

**Goal:** Add a `version` field to the encrypted payload so future schema changes have a migration path.

**Current format stored in localStorage:**
```json
{ "iv": [12 bytes], "data": [ciphertext bytes] }
```

**Approach:**

Add `version` to the outer wrapper (not inside the encrypted data — it must be readable without decrypting):

```typescript
// src/utils/crypto-utils.ts or wherever the vault is serialised
const VAULT_VERSION = 1;

// When saving:
localStorage.setItem(storageKey, JSON.stringify({
  version: VAULT_VERSION,
  iv: Array.from(iv),
  data: Array.from(ciphertext)
}));

// When loading:
const stored = JSON.parse(raw);
const version = stored.version ?? 0; // 0 = legacy, no version field
if (version < VAULT_VERSION) {
  // run migration
}
```

Keep a `migrateVault(version, encryptedBlob)` function in a new `src/utils/vault-migration.ts`. For now it just returns the blob unchanged — having the structure in place is what matters.

**Files:** `src/main.ts` (save path), `src/services/VaultUnlockService.ts` (load path), new `src/utils/vault-migration.ts`.

---

## Phase 2 — Security improvements

These require more thought and some have test coverage implications.

---

### 2.1 Replace regex XSS detection with DOM-based sanitisation

**Goal:** `SecurityScanner.detectXSS()` uses regex patterns that can be bypassed. Replace with a structural check using `DOMParser`.

**Current approach** (`src/security.ts`): 15+ regex patterns checked against the raw string.

**Better approach:** Parse the input as HTML and inspect the resulting DOM tree for dangerous elements and attributes. The browser's own parser handles all encoding variations, case folding, and malformed HTML that regex misses:

```typescript
// src/security.ts
detectXSS(input: string): boolean {
  const doc = new DOMParser().parseFromString(input, 'text/html');

  // Dangerous elements
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'base', 'form', 'meta', 'link'];
  for (const tag of dangerousTags) {
    if (doc.getElementsByTagName(tag).length > 0) return true;
  }

  // Dangerous attributes on any element
  const allElements = doc.getElementsByTagName('*');
  for (const el of Array.from(allElements)) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.toLowerCase().trim();
      if (name.startsWith('on')) return true;                    // event handlers
      if (['href', 'src', 'action'].includes(name)) {
        if (value.startsWith('javascript:') || value.startsWith('data:')) return true;
      }
    }
  }

  return false;
}
```

**Files:** `src/security.ts`.

**Tests to add** (`src/security.test.ts` — create if it doesn't exist):

```typescript
// Known bypass patterns that regex misses:
detectXSS('<ScRiPt>alert(1)</ScRiPt>')          // case variation
detectXSS('<img src=x onerror=alert(1)>')        // attribute injection
detectXSS('<svg><script>alert(1)</script></svg>') // SVG namespace
detectXSS('<a href="javascript:alert(1)">')      // JS URL
detectXSS('<<script>alert(1)//<</script>')       // malformed tag
detectXSS('<img src="data:text/html,<script>")') // data URI
```

Each of these should return `true`. Add safe strings that must return `false`:
```typescript
detectXSS('My Gmail account')     // false
detectXSS('user@email.com')       // false
detectXSS('100% secure!')         // false — percent not a vector
```

---

### 2.2 Remove `style-src 'unsafe-inline'` from CSP

**Goal:** Tighten the CSP by eliminating the `unsafe-inline` exception for styles.

**Approach — audit first:**

Search the codebase for inline styles:
```bash
grep -r "style=" src/ --include="*.ts" --include="*.html"
grep -r "element.style\." src/ --include="*.ts"
```

For each inline style found, either:
1. Move it to `theme.css` as a class and apply the class via `classList`
2. Use a CSS custom property that the element reads from `:root`

The glassmorphism UI uses CSS variables already — this should be mostly converting `element.style.display = 'none'` to `element.classList.add('hidden')` etc.

**Files:** `src/theme.css`, affected component files, `index.html`, `public/_headers`, `vercel.json`, `.htaccess`, `nginx.conf`.

**After removing:** update the CSP in all four deployment config files:
```
style-src 'self' https://fonts.googleapis.com;
```
(remove `'unsafe-inline'`)

**Gotcha:** Chart.js (if/when added in a later phase) may inject inline styles for chart canvas dimensions. Address that at the time.

---

### 2.3 Wasm binary integrity check (SRI)

**Goal:** Add a Subresource Integrity hash to the Wasm import so a tampered build artifact is rejected.

**Approach:**

Add a build script that computes the SHA-256 hash of the compiled `.wasm` file and writes it to a manifest:

```bash
# scripts/compute-wasm-hash.sh
HASH=$(openssl dgst -sha256 -binary src/pkg/securepass_wasm_bg.wasm | openssl base64 -A)
echo "sha256-$HASH"
```

Alternatively, do this in Node inside `package.json` scripts:

```json
"build:wasm:hash": "node scripts/wasm-integrity.js"
```

```javascript
// scripts/wasm-integrity.js
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const wasm = readFileSync('src/pkg/securepass_wasm_bg.wasm');
const hash = createHash('sha256').update(wasm).digest('base64');
writeFileSync('src/pkg/wasm-integrity.json', JSON.stringify({ sri: `sha256-${hash}` }));
```

Then in the Wasm loader, verify at runtime:

```typescript
// src/services/WasmCryptoService.ts
import integrityManifest from '../pkg/wasm-integrity.json';

static async ensureInitialized(): Promise<void> {
  if (!this.initialized) {
    const response = await fetch('/assets/securepass_wasm_bg.wasm');
    const buffer = await response.arrayBuffer();

    // Verify hash before compiling
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    const expected = integrityManifest.sri.replace('sha256-', '');
    if (hashBase64 !== expected) {
      throw new Error('Wasm binary integrity check failed');
    }

    await init(buffer);
    this.initialized = true;
  }
}
```

Wire `build:wasm:hash` into the `build` script: `"build": "npm run build:wasm && npm run build:wasm:hash && tsc && vite build"`.

**Files:** `scripts/wasm-integrity.js` (new), `src/services/WasmCryptoService.ts`, `package.json`.

---

### 2.4 Document biometric threat model

**Goal:** Explicitly state what the biometric unlock protects against and what it does not.

**Approach:** Add a section to `DEVELOPER_MANUAL.md` under the security features section:

Key points to document:
- `bio_credential_id` + `bio_wrapped_password` + `bio_iv` are all in `localStorage` in plaintext/predictable form
- An attacker who exfiltrates these three values cannot decrypt `bio_wrapped_password` without a valid WebAuthn assertion from the enrolled device — the private key never leaves the authenticator
- What this means: biometric unlock security is equivalent to WebAuthn device possession. If the device is compromised (OS-level malware), biometric bypass is possible via a fake WebAuthn assertion
- The master password path (Argon2id) is independent and not weakened by the biometric path

**Files:** `DEVELOPER_MANUAL.md`.

---

## Phase 3 — Architecture refactoring

Do these after the Phase 1 and 2 fixes are stable and tested, as they touch core wiring.

---

### 3.1 Split `main.ts` into command handlers

**Goal:** `main.ts` currently has all event listeners inlined. As the app grows this becomes unmanageable.

**Approach — event bus pattern:**

Create `src/events/EventBus.ts` as a typed event registry:

```typescript
// src/events/EventBus.ts
type Handler<T = unknown> = (detail: T) => void | Promise<void>;

const handlers = new Map<string, Handler[]>();

export const EventBus = {
  on<T>(event: string, handler: Handler<T>): void {
    const list = handlers.get(event) ?? [];
    list.push(handler as Handler);
    handlers.set(event, list);
    document.addEventListener(event, ((e: CustomEvent<T>) => handler(e.detail)) as EventListener);
  },

  emit<T>(event: string, detail?: T): void {
    document.dispatchEvent(new CustomEvent(event, { detail, bubbles: true }));
  }
};
```

Then extract handlers into domain files:

```
src/
  events/
    EventBus.ts
    handlers/
      auth.handlers.ts       // unlock-btn, lock-vault, biometric
      vault.handlers.ts      // entry-saved, save-vault, delete-entry
      ui.handlers.ts         // category-change, modal-opened, autolock-setting
```

`main.ts` becomes an import-and-register file:

```typescript
// src/main.ts
import './events/handlers/auth.handlers.js';
import './events/handlers/vault.handlers.js';
import './events/handlers/ui.handlers.js';
```

**Files:** `src/main.ts`, new `src/events/` directory and files.

**Do not refactor everything at once.** Move one event group at a time, run tests after each move.

---

### 3.2 Decoy vault storage key naming

**Goal:** `decoy_salt` in `localStorage` reveals the existence of a decoy vault to anyone who opens DevTools.

**Current keys:** `vault_salt`, `decoy_salt`, `decoy_vault`.

**Options:**

1. **Rename to non-revealing keys** — e.g., `vault_salt_2`, `vault_b`, `vault_s2`. Simple, but still two salt keys visible. An attacker who knows the codebase will recognise the pattern.

2. **Store both salts in a single key** — e.g., `vault_meta` holds `{ s1: "...", s2: "..." }`. The number of salts is still visible.

3. **Accept the current state** — the existence of a second vault is already inferable from `decoy_vault` being in localStorage. Renaming keys provides minimal additional protection against an attacker who has read access. Document this as a known limitation.

**Recommendation:** Option 3 for now — document it. Proper coercion resistance requires the decoy vault to be indistinguishable from a normal vault, which means a structural redesign: single storage key, unlock-time determination of which vault to load. That is a larger change with risk of breaking the existing flow.

If pursued: the redesign stores both vaults under opaque keys (`vault_a`, `vault_b`); the unlock logic tries both keys with the provided password and uses whichever decrypts successfully. The Argon2id step is the discriminator. This is how KeePass implements duress.

**Files:** `src/services/VaultUnlockService.ts`, `src/main.ts`, `src/state/VaultState.ts`, `DEVELOPER_MANUAL.md`.

---

## Phase 4 — Testing

Run in parallel with the above phases — add tests as each fix is made rather than in a single batch.

---

### 4.1 Playwright E2E tests

**Goal:** Test the full encrypt → persist → reload → decrypt flow in a real browser.

**Setup:**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

**Core test — vault round-trip:**

```typescript
// tests/e2e/vault.spec.ts
test('create vault, add entry, survive page reload', async ({ page }) => {
  await page.goto('/');
  // Setup: first-time vault creation
  await page.fill('[data-testid="master-password"]', 'CorrectHorseBatteryStaple!!1');
  await page.click('[data-testid="create-vault"]');

  // Add an entry
  await page.click('[data-testid="new-entry"]');
  await page.fill('[data-testid="entry-title"]', 'Test Service');
  await page.fill('[data-testid="entry-password"]', 'hunter2');
  await page.click('[data-testid="save-entry"]');

  // Lock and reload
  await page.click('[data-testid="lock-vault"]');
  await page.reload();

  // Unlock and verify entry persisted
  await page.fill('[data-testid="master-password"]', 'CorrectHorseBatteryStaple!!1');
  await page.click('[data-testid="unlock-btn"]');
  await expect(page.locator('text=Test Service')).toBeVisible();
});
```

For this to work, add `data-testid` attributes to the relevant HTML elements — this is a prerequisite step.

**Additional E2E tests to write:**
- Wrong password → access denied
- Duress password → decoy vault
- Toggle auto-lock duration
- Export backup → import backup → entries match
- Biometric enrollment (can be skipped in CI with `test.skip` since it requires device hardware)

**Add to `package.json`:**
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

---

### 4.2 Expand duress mode tests

**Current tests** (`src/services/VaultUnlockService.test.ts`): 4 tests covering the basic unlock and duress fallthrough.

**Additional cases to add:**

```typescript
// Missing test cases:

it('falls through to decoy after real vault fails', async () => { ... });
it('returns isDecoyMode=true when decoy vault is matched', async () => { ... });
it('returns success=false when neither vault decrypts', async () => { ... });
it('uses decoy_salt not vault_salt when unlocking decoy', async () => { ... });
it('save-vault writes to decoy_vault key when isDecoyMode is true', async () => { ... });
it('uses correct salt when decoy_vault does not yet exist', async () => { ... });
```

---

### 4.3 XSS scanner test suite

**Create `src/security.test.ts`** with explicit bypass attempt coverage:

```typescript
// Patterns that must return true (detected as XSS):
const malicious = [
  '<script>alert(1)</script>',
  '<ScRiPt>alert(1)</ScRiPt>',             // case variation
  '<img src=x onerror=alert(1)>',           // event handler
  '<svg><script>alert(1)</script></svg>',   // SVG namespace
  '<a href="javascript:alert(1)">x</a>',   // JS protocol
  '<iframe src="data:text/html,...">',      // data URI
  '<<script>alert(1)//<</script>',          // malformed
  '<img src="x" onmouseover="alert(1)">',  // hover handler
  '<body onload=alert(1)>',                 // body event
];

const safe = [
  'My Gmail account',
  'user@example.com',
  'Password123!',
  '100% secure',
  'C:\\Users\\name',
  "it's a password",
];
```

---

### 4.4 CSP header verification

**Approach:** Use Playwright to check that deployed response headers are correct:

```typescript
// tests/e2e/headers.spec.ts
test('CSP header is present and correct', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response?.headers()['content-security-policy'];
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("connect-src 'self' https://api.pwnedpasswords.com");
  expect(csp).not.toContain("'unsafe-eval'");
});
```

Note: this test validates headers from the dev server (Vite) or a local production build (`vite preview`). It will not test the Vercel/Netlify/Nginx configs — those must be tested post-deploy.

---

## Phase 5 — Functional gaps

These are larger features. Each is a self-contained project.

---

### 5.1 Vault backup / export + Cross-device sync via File System API

This section covers two tiers of the same feature. Build them in order — Tier 1 is a prerequisite for Tier 2.

---

#### Why localStorage alone is not enough

`localStorage` is persistent across browser restarts but is not durable:

- Clearing browser data (privacy mode, "Clear Site Data", browser reinstall) wipes the vault with no recovery path.
- It is bound to one browser profile on one device.
- There is no export or backup mechanism today.

A `.spvault` file addresses both problems: it is a portable copy of the encrypted vault that the user controls, and it can be copied to a cloud folder (Dropbox, iCloud Drive, etc.) to enable cross-device access.

**The file is safe to store anywhere** — it contains only AES-256-GCM ciphertext. Without the master password and Argon2id key derivation, it is opaque data.

---

#### The `.spvault` file format

The file is plain JSON. Its structure reuses the existing `localStorage` format plus a file-level envelope:

```json
{
  "format": "spvault",
  "version": 1,
  "created_at": "2026-03-19T12:00:00Z",
  "modified_at": "2026-03-19T14:30:00Z",
  "vault": {
    "version": 1,
    "iv": [/* 12 bytes */],
    "data": [/* AES-256-GCM ciphertext + 16-byte auth tag */]
  },
  "salt": "base64-encoded-256-bit-salt",
  "decoy_vault": {
    "version": 1,
    "iv": [/* 12 bytes */],
    "data": [/* decoy ciphertext */]
  },
  "decoy_salt": "base64-encoded-256-bit-decoy-salt"
}
```

`decoy_vault` and `decoy_salt` are omitted if the user has not set up a duress password.

`version` at the file level (`format: "spvault"`, `version: 1`) allows future format changes. `version` inside each vault blob is the existing payload version from item 1.6.

**Create a type for this in `src/types.ts`:**

```typescript
export interface SpvaultFile {
  format: 'spvault';
  version: number;
  created_at: string;
  modified_at: string;
  vault: EncryptedBlob;
  salt: string;
  decoy_vault?: EncryptedBlob;
  decoy_salt?: string;
}

export interface EncryptedBlob {
  version: number;
  iv: number[];
  data: number[];
}
```

---

#### Tier 1 — Backup export / import (all browsers)

This works in Chrome, Firefox, and Safari. No special API beyond what the browser already provides.

**Export — trigger a file download:**

```typescript
// src/utils/vault-export.ts
import type { SpvaultFile } from '../types.js';

export function exportVault(): void {
  const raw = localStorage.getItem('encrypted_vault');
  const salt = localStorage.getItem('vault_salt');
  if (!raw || !salt) throw new Error('No vault to export');

  const vault = JSON.parse(raw);
  const decoyRaw = localStorage.getItem('decoy_vault');
  const decoySalt = localStorage.getItem('decoy_salt');

  const file: SpvaultFile = {
    format: 'spvault',
    version: 1,
    created_at: getStoredCreatedAt() ?? new Date().toISOString(),
    modified_at: new Date().toISOString(),
    vault,
    salt,
    ...(decoyRaw && decoySalt
      ? { decoy_vault: JSON.parse(decoyRaw), decoy_salt: decoySalt }
      : {}),
  };

  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `securepass-backup-${formatDate(new Date())}.spvault`;
  a.click();

  // Revoke the object URL after a short delay to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // "2026-03-19"
}
```

`getStoredCreatedAt()` reads a `vault_created_at` key from `localStorage` — add this when the vault is first created so backup files retain the original creation date across exports.

**Import — read a file and restore to localStorage:**

```typescript
// src/utils/vault-import.ts
import type { SpvaultFile } from '../types.js';

export async function importVaultFile(file: File): Promise<void> {
  const text = await file.text();
  let parsed: SpvaultFile;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  // Validate structure
  if (parsed.format !== 'spvault') throw new Error('Not a .spvault file');
  if (!parsed.vault || !parsed.salt) throw new Error('Missing vault or salt');

  // Write to localStorage — the normal unlock flow will validate the password
  localStorage.setItem('encrypted_vault', JSON.stringify(parsed.vault));
  localStorage.setItem('vault_salt', parsed.salt);

  if (parsed.decoy_vault && parsed.decoy_salt) {
    localStorage.setItem('decoy_vault', JSON.stringify(parsed.decoy_vault));
    localStorage.setItem('decoy_salt', parsed.decoy_salt);
  }
}
```

Show a file picker for import:

```typescript
// In the settings or setup UI component
const input = document.createElement('input');
input.type = 'file';
input.accept = '.spvault,application/json';
input.onchange = async () => {
  const file = input.files?.[0];
  if (!file) return;
  await importVaultFile(file);
  // Prompt user to enter master password to confirm the import worked
  document.dispatchEvent(new CustomEvent('show-unlock-screen'));
};
input.click();
```

**UI entry points to add:**
- Settings panel: "Export backup" button (always visible when vault is unlocked)
- Settings panel: "Import from backup" button (available on lock screen too — so a user can restore before unlocking)
- First-time setup: "I have a backup file" option alongside "Create new vault"

**Files:** `src/utils/vault-export.ts` (new), `src/utils/vault-import.ts` (new), `src/types.ts` (add `SpvaultFile`, `EncryptedBlob`), settings component, setup wizard component.

---

#### Tier 2 — File System Access API (live file sync, Chrome/Edge only)

**Browser support as of 2026:**

| Browser | `showSaveFilePicker` | Handle storage in IndexedDB |
|---|---|---|
| Chrome / Edge | Yes | Yes |
| Firefox | No | — |
| Safari | Partial (macOS 15.2+) | Partial |

Always check support before using:

```typescript
const hasFileSystemAPI = 'showSaveFilePicker' in window;
```

Fall back to `localStorage` silently when unsupported. Never show the File System option in UI on unsupported browsers.

---

**How it works end-to-end:**

The user designates a `.spvault` file once. From that point, every vault save writes to the file instead of (or in addition to) `localStorage`. On the next browser session, the saved handle is retrieved from IndexedDB and used to read the file directly — no re-picking needed.

Sequence:

```
First time:
  User clicks "Link a vault file"
  → showSaveFilePicker() or showOpenFilePicker()
  → user picks/creates file
  → handle saved to IndexedDB
  → vault written to file immediately

Subsequent sessions:
  App loads
  → loadHandle() from IndexedDB
  → handle exists? → queryPermission('readwrite')
    → permission granted? → read file → load vault
    → permission denied? → re-request, or fall back to localStorage
  → handle missing? → use localStorage

Every save:
  encrypt vault
  → file handle available? → write to file
  → always also write to localStorage (belt-and-suspenders)
```

---

**Install the IndexedDB wrapper:**

```bash
npm install idb
```

`idb` is a tiny (~1 kB) typed wrapper around the IndexedDB API. It is the standard choice for this use case.

---

**File handle persistence (`src/utils/file-sync.ts`):**

```typescript
import { openDB, type IDBPDatabase } from 'idb';

interface SyncDB {
  handles: {
    key: string;
    value: FileSystemFileHandle;
  };
}

let _db: IDBPDatabase<SyncDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SyncDB>> {
  if (_db) return _db;
  _db = await openDB<SyncDB>('securepass-sync', 1, {
    upgrade(db) {
      db.createObjectStore('handles');
    },
  });
  return _db;
}

export async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await getDB();
  await db.put('handles', handle, 'vault-file');
}

export async function loadHandle(): Promise<FileSystemFileHandle | undefined> {
  const db = await getDB();
  return db.get('handles', 'vault-file');
}

export async function clearHandle(): Promise<void> {
  const db = await getDB();
  await db.delete('handles', 'vault-file');
}
```

---

**Requesting permission on each session:**

Permissions granted to a `FileSystemFileHandle` do not persist across browser sessions — the browser requires the user to confirm access each time:

```typescript
// src/utils/file-sync.ts
export async function requestReadWritePermission(
  handle: FileSystemFileHandle
): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}
```

`requestPermission()` requires a user gesture (click event). Do not call it during an automatic startup sequence — call it in response to the user clicking "Unlock" or "Connect vault file". The browser will block silent permission requests.

---

**Reading the vault from file:**

```typescript
// src/utils/file-sync.ts
export async function readVaultFile(
  handle: FileSystemFileHandle
): Promise<SpvaultFile> {
  const file = await handle.getFile();
  const text = await file.text();
  const parsed: SpvaultFile = JSON.parse(text);
  if (parsed.format !== 'spvault') throw new Error('Not a .spvault file');
  return parsed;
}
```

---

**Writing the vault to file:**

```typescript
// src/utils/file-sync.ts
export async function writeVaultFile(
  handle: FileSystemFileHandle,
  data: SpvaultFile
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}
```

`createWritable()` truncates the file before writing — no partial write risk.

---

**VaultSyncService — orchestrates file vs localStorage (`src/services/VaultSyncService.ts`):**

```typescript
import { saveHandle, loadHandle, clearHandle, requestReadWritePermission,
         readVaultFile, writeVaultFile } from '../utils/file-sync.js';
import type { SpvaultFile } from '../types.js';

export class VaultSyncService {
  private static handle: FileSystemFileHandle | null = null;

  static isFileMode(): boolean {
    return this.handle !== null;
  }

  /** Called on app startup — tries to reconnect to a previously linked file. */
  static async tryRestoreHandle(): Promise<boolean> {
    if (!('showSaveFilePicker' in window)) return false;
    const stored = await loadHandle();
    if (!stored) return false;
    const ok = await requestReadWritePermission(stored);
    if (ok) {
      this.handle = stored;
      return true;
    }
    return false;
  }

  /** Called when user explicitly links a new file. Requires a user gesture. */
  static async linkFile(mode: 'create' | 'open'): Promise<void> {
    const pickerOpts = {
      suggestedName: 'securepass.spvault',
      types: [{ description: 'SecurePass Vault', accept: { 'application/json': ['.spvault'] } }],
    };

    const handle = mode === 'create'
      ? await window.showSaveFilePicker(pickerOpts)
      : (await window.showOpenFilePicker(pickerOpts))[0];

    await saveHandle(handle);
    this.handle = handle;
  }

  /** Returns the current SpvaultFile from file or builds one from localStorage. */
  static async readVault(): Promise<SpvaultFile | null> {
    if (this.handle) {
      try {
        return await readVaultFile(this.handle);
      } catch {
        // File may have been deleted or moved — fall through to localStorage
        this.handle = null;
        await clearHandle();
      }
    }
    return null; // caller falls back to localStorage
  }

  /** Writes the vault. Always writes to localStorage; also writes to file if linked. */
  static async writeVault(data: SpvaultFile): Promise<void> {
    // Belt-and-suspenders: always keep localStorage in sync
    localStorage.setItem('encrypted_vault', JSON.stringify(data.vault));
    localStorage.setItem('vault_salt', data.salt);
    if (data.decoy_vault) localStorage.setItem('decoy_vault', JSON.stringify(data.decoy_vault));
    if (data.decoy_salt) localStorage.setItem('decoy_salt', data.decoy_salt);

    if (this.handle) {
      await writeVaultFile(this.handle, {
        ...data,
        modified_at: new Date().toISOString(),
      });
    }
  }

  /** Unlinks the file. Vault remains in localStorage. */
  static async unlinkFile(): Promise<void> {
    this.handle = null;
    await clearHandle();
  }
}
```

---

**Integrating VaultSyncService into the save/load paths:**

In `main.ts`, find every place `localStorage.setItem('encrypted_vault', ...)` is called and replace with `VaultSyncService.writeVault(...)`.

In `VaultUnlockService.ts`, on unlock:

```typescript
// src/services/VaultUnlockService.ts
import { VaultSyncService } from './VaultSyncService.js';

// At the start of unlock():
const fileVault = await VaultSyncService.readVault();
const encryptedVault = fileVault
  ? JSON.stringify(fileVault.vault)
  : localStorage.getItem('encrypted_vault');
const salt = fileVault
  ? fileVault.salt
  : localStorage.getItem('vault_salt');
```

---

**Startup sequence in `main.ts`:**

```typescript
// src/main.ts — on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  const hasFileSync = await VaultSyncService.tryRestoreHandle();
  if (hasFileSync) {
    // File mode active — show indicator in UI
    document.dispatchEvent(new CustomEvent('file-sync-active'));
  }
  // ... rest of startup
});
```

`tryRestoreHandle()` is non-blocking — if no handle exists or permission is denied, startup continues normally with `localStorage`.

---

**UI changes to add:**

In the settings panel (unlocked state):

- "Vault storage: Browser only" / "Vault storage: Linked to [filename]" — status indicator
- "Export backup" button → calls `exportVault()` (Tier 1, always available)
- "Link a vault file" button (only shown if `hasFileSystemAPI`) → calls `VaultSyncService.linkFile('create')`
- "Open existing vault file" button → calls `VaultSyncService.linkFile('open')`
- "Unlink file" button (shown only when in file mode) → calls `VaultSyncService.unlinkFile()`

On the lock screen / setup screen:

- "I have a backup file" → `importVaultFile()` (Tier 1)
- "Open linked vault file" → `VaultSyncService.linkFile('open')` (Tier 2, Chrome only)

---

**Conflict resolution**

If the user edits the vault on machine A and machine B both have the same file linked (via Dropbox etc.), there is a potential conflict when both write. The simplest approach is **last-write-wins** — whoever saves last overwrites the other. This is safe because:

- The file is always encrypted — no data is exposed in a conflict
- The vault is append-heavy (users add entries far more than they delete)
- `modified_at` in the file envelope can be used to detect staleness

For now: implement last-write-wins and document it. A proper merge strategy (OT or CRDT) is out of scope for Phase 1.

---

**Cross-device workflow (what the user actually does)**

Without a server, cross-device sync is manual file copy:

1. User links vault to a file in their Dropbox/iCloud Drive folder on machine A
2. File is automatically synced to cloud by Dropbox/iCloud
3. User opens SecurePass on machine B, clicks "Open existing vault file", picks the same file from the synced folder
4. Handle is saved in machine B's IndexedDB
5. From now on, saves on machine B write to the cloud-synced file

This is exactly how KeePass + Dropbox works for millions of people. It is not seamless but it is reliable and requires zero backend infrastructure.

---

**Files summary:**

| File | Status | Purpose |
|---|---|---|
| `src/types.ts` | Update | Add `SpvaultFile`, `EncryptedBlob` types |
| `src/utils/vault-export.ts` | New | Tier 1 export (download) |
| `src/utils/vault-import.ts` | New | Tier 1 import (file picker read) |
| `src/utils/file-sync.ts` | New | IndexedDB handle persistence + file read/write |
| `src/services/VaultSyncService.ts` | New | Orchestrates file vs localStorage |
| `src/services/VaultUnlockService.ts` | Update | Read from file handle on unlock |
| `src/main.ts` | Update | Startup handle restore; route saves through VaultSyncService |
| Settings component | Update | Export/link/unlink UI |
| Setup wizard component | Update | Import / open file options |
| `package.json` | Update | Add `idb` dependency |

**Dependencies:** `npm install idb`

**Gotchas:**
- `requestPermission()` must be called from a user gesture — never from a timer or automatic startup flow
- Firefox does not support File System Access API — detect before showing UI options
- Safari on iOS does not support it — detect on mobile too
- Writing to the file while the user is mid-edit can be avoided by debouncing writes (500ms after last change)
- IndexedDB is also browser-local — if the user clears all site data, the handle is lost (but the file on disk remains, and can be re-linked)

---

### 5.2 Import from other password managers

**Goal:** Let users import credentials from Bitwarden, Chrome, and LastPass CSV exports.

**Approach:**

Each source format maps to `VaultEntry[]`. Create a single import pipeline:

```
File input (CSV/JSON)
  → detect format (by header row or file extension)
  → parse to RawImportEntry[]
  → map to VaultEntry[]
  → show preview (count, duplicate detection)
  → user confirms
  → add to vault, save
```

**Format parsers** in `src/utils/importers/`:

```
importers/
  bitwarden.ts    // JSON: { items: [{ name, login: { username, password, totp } }] }
  chrome.ts       // CSV: name,url,username,password
  lastpass.ts     // CSV: url,username,password,totp,extra,name,grouping,fav
  onepassword.ts  // .1pux is a zip containing JSON
```

Each parser exports:
```typescript
export function parse(raw: string): VaultEntry[]
```

**Duplicate detection:** before inserting, check `title + username` pairs against existing entries. Show a summary: "42 entries found, 3 duplicates skipped."

**Files:** `src/utils/importers/` (new directory), `src/components/shared/SetupWizard.ts` (add import UI option).

---

### 5.3 Browser extension

This is the largest item and should be treated as a separate sub-project.

**Directory structure:**

```
extension/
  manifest.json          # MV3 manifest
  background/
    service-worker.ts    # holds CryptoBridge, handles messages
  content/
    autofill.ts          # detects password fields, injects fill UI
  popup/
    popup.html
    popup.ts             # mini UI: unlock, search, fill
  pkg/                   # Wasm output (symlink or copy from src/pkg)
```

**The core problem — Wasm in a service worker:**

MV3 service workers support `importScripts()` but not ES module `import` in all browsers. `wasm-pack --target bundler` produces output suitable for bundling. The extension needs its own Rollup/Vite build that bundles the Wasm glue into a single file the service worker can load via `importScripts`.

**The session persistence problem:**

Service workers sleep after ~30 seconds. `CryptoBridge` (and thus the unlocked vault) is lost when the worker sleeps. Options:

1. **Re-prompt on wake** — simplest; user re-enters master password when the service worker wakes. Acceptable if auto-lock is short anyway.
2. **Session storage** — not available in service workers.
3. **Encrypted session token** — on unlock, encrypt the master password with a session key derived from a random value stored in `chrome.storage.session` (cleared when browser closes). Re-derive `CryptoBridge` on each service worker wake using the session key. Complex but avoids re-prompting.

Start with option 1. Implement option 3 if users report the re-prompt being too frequent.

**Message passing security:**

All messages between popup/content/background must validate sender origin:

```typescript
// extension/background/service-worker.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false; // reject external senders
  // handle message
});
```

**Auto-fill content script:**

Detect password fields on page load and mutation:

```typescript
// extension/content/autofill.ts
function findLoginForms(): { usernameField: HTMLInputElement | null, passwordField: HTMLInputElement } [] {
  return Array.from(document.querySelectorAll('input[type="password"]'))
    .map(pwdField => ({
      passwordField: pwdField as HTMLInputElement,
      usernameField: findPrecedingUsernameField(pwdField as HTMLInputElement)
    }));
}
```

Fill by setting `.value` and dispatching both `input` and `change` events — most frameworks (React, Vue, Angular) use synthetic events and will not see a raw `.value` assignment without the event:

```typescript
function fillField(field: HTMLInputElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  nativeInputValueSetter?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}
```

**Files:** Entire `extension/` directory is new. Share `src/types.ts` and Wasm output — do not duplicate the cryptographic logic.

---

## Implementation order summary

```
Phase 1 (do first — small, independent):
  1.1  Clipboard auto-clear
  1.2  Lock on visibility change
  1.3  Argon2id parameter documentation + correction
  1.4  Component error boundaries
  1.5  Remove `any` from WasmCryptoService
  1.6  Vault format versioning

Phase 2 (security — medium effort):
  2.1  DOM-based XSS detection (write new tests alongside)
  2.2  Remove style-src unsafe-inline (audit first)
  2.3  Wasm binary integrity check
  2.4  Document biometric threat model

Phase 3 (architecture — after Phase 1+2 are stable):
  3.1  Split main.ts into event handlers
  3.2  Decide on decoy vault key naming

Phase 4 (tests — in parallel with all phases):
  4.1  Playwright E2E setup + vault round-trip test
  4.2  Duress mode edge cases
  4.3  XSS scanner bypass table
  4.4  CSP header test

Phase 5 (new features — after the above is solid):
  5.1a Vault backup export / import (Tier 1 — all browsers, do first)
  5.1b File System API live sync (Tier 2 — Chrome/Edge only, builds on 5.1a)
  5.2  Import from other password managers
  5.3  Browser extension (largest — own sub-project)
```
