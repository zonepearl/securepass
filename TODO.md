# TODO

---

## Functional gaps

- [ ] **Browser extension** — auto-fill content script, background service worker holds `CryptoBridge` across sleep/wake, secure message passing between popup/background/content, Chrome + Firefox targets
- [ ] **Vault backup / export** — one-click export of the full encrypted vault to a `.spvault` file (download via `<a download>`); import from file to restore or merge; works in all browsers, no API required; this is the prerequisite step before File System API sync
- [ ] **Cross-device sync (phase 1 — File System API)** — let the user designate a local `.spvault` file as the live vault store; read on unlock, write on every save; handle persisted in IndexedDB across reloads; falls back to `localStorage` in Firefox/Safari where the API is unavailable; enables cross-device use via manual file copy (e.g. to a cloud folder)
- [ ] **Cross-device sync (phase 2)** — user-supplied cloud storage (Dropbox, Google Drive) with client-side AES-GCM before upload
- [ ] **Clipboard auto-clear** — clear clipboard 30 seconds after any password copy (`setTimeout(() => navigator.clipboard.writeText(''), 30_000)`)
- [ ] **Import** — support Bitwarden JSON, 1Password `.1pux`, LastPass CSV, Chrome/Firefox CSV export

---

## Security

- [ ] **Replace regex XSS detection** — `SecurityScanner` pattern matching can be bypassed; replace with DOM-based sanitisation (`DOMParser` + tree inspection, or DOMPurify)
- [ ] **Remove `style-src 'unsafe-inline'`** — move component inline styles to external CSS files so `unsafe-inline` can be dropped from CSP
- [ ] **Document and verify Argon2id parameters** — confirm `m_cost`, `t_cost`, `p_cost` in `lib.rs` meet OWASP minimums (m≥47104 KiB, t≥1, p=1); add a comment with the rationale
- [ ] **Wasm binary integrity** — add `integrity="sha256-..."` SRI attribute to the Wasm module import so a tampered build artifact is rejected
- [ ] **Document biometric threat model** — note explicitly that `bio_credential_id` + `bio_wrapped_password` + `bio_iv` in localStorage are safe only while WebAuthn device presence is enforced
- [ ] **Lock on tab visibility change** — `document.addEventListener('visibilitychange', ...)` should trigger the auto-lock in addition to the inactivity timer

---

## Architecture

- [ ] **Split `main.ts`** — it coordinates all custom events from all 13 components; extract a typed event bus or per-command handler registry before it becomes unmanageable
- [ ] **Component error boundaries** — wrap each `connectedCallback` in try/catch with a fallback render; an unguarded throw currently crashes the whole app silently
- [ ] **Remove `any` from `WasmCryptoService`** — `bridge: any` in static methods loses type safety; use the types from the generated `securepass_wasm.d.ts`
- [ ] **Vault format versioning** — add a `version` field to the encrypted payload so future schema changes have a migration path without breaking existing backups
- [ ] **Decoy vault storage key naming** — `decoy_salt` in `localStorage` makes the existence of a decoy vault visible to a forensic examiner; evaluate whether this is acceptable for the target threat model

---

## Testing

- [ ] **E2E tests (Playwright)** — create vault → add entry → lock → reload → unlock → verify entry; this is the most effective regression test for the full encrypt/persist/decrypt flow
- [ ] **Expand duress mode tests** — currently 4 tests; add: correct real password after a duress unlock, missing decoy vault, corrupted decoy vault
- [ ] **XSS scanner bypass table** — add known bypass patterns (encoding tricks, parser differentials) as test cases against `SecurityScanner` so regressions are caught
- [ ] **CSP header tests** — verify that `frame-ancestors`, `script-src`, and `connect-src` are correctly set in all deployment configurations

---

## Backlog

- [ ] Lock on browser sleep / screensaver (Page Visibility + Screen Wake Lock API events)
- [ ] PWA manifest — offline capability and installable from browser
- [ ] CLI tool — vault management, password generation, TOTP output for scripting and CI use
- [ ] Automated breach scan on vault unlock (vs current on-demand only)
- [ ] Offline HIBP bloom filter — local database, no outbound API call
- [ ] Custom fields per entry (text, hidden, date, URL types)
- [ ] File attachments — phase 1: IndexedDB local; phase 2: encrypted cloud
- [ ] Emergency access — printable recovery codes; trusted-contact delegation with wait period
- [ ] Hardware key support — YubiKey / FIDO2 as second factor, then as primary
- [ ] Secure share links — encrypted URL fragment, configurable expiration
