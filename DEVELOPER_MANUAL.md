# SecurePass Developer Manual

**Version:** 1.0.0  
**Security Model:** Zero-Knowledge, Client-Side Only  
**Architecture:** Modern Web Components & Reactive State

---

## 🏗️ Architecture Overview

SecurePass is built as a highly modular, static web application. It uses **Web Components** for UI encapsulation and a **Singleton State** for business logic.

### 1. The State Tier (`src/state/VaultState.ts`)
The `VaultState` singleton is the "brain" of the application. It handles all data mutations, filtering, and notifies subscribers (UI components) when changes occur.

```typescript
// Example: Subscribing to state changes in a component
this.unsubscribe = vaultState.subscribe(() => {
    this.render();
});
```

### 2. Component Layer (`src/components/`)
UI is broken into reusable Custom Elements:
- `VaultTable`: Data grid with category/search filtering.
- `EntryModal`: Creation/Edit interface with generator & history.
- `VaultSidebar`: Navigation and category management.
- `DuressMode`: Decoy vault setup and logic.
- `ToastNotification`: Non-blocking user feedback.

---

## 🔐 Core Security Features

### 1. Password History
SecurePass tracks the last 5 passwords for every entry. This is stored within the encrypted vault data.

**How it works:**
Whenever `VaultState.updateEntry` detects a change in the `password` field, the previous password is prepended to the `history` array.

```typescript
// Example: Password History tracking
if (updates.password && updates.password !== entry.password) {
    const history = entry.history || [];
    updates.history = [entry.password, ...history].slice(0, 5);
}
```

### 2. Duress Mode (Decoy Vault)
Allows users to set up a secondary vault that opens with a different master password.

**Technical Implementation:**
Authentication uses a fallthrough mechanism. If the primary vault fails to decrypt, the system attempts to decrypt the `decoy_vault` slot using the same password. If successful, it enters "Decoy Mode" (`isDecoyMode = true`), and all subsequent saves are diverted to the decoy slot.

### 3. Auto-Lock Service
Protects the vault from unauthorized access during inactivity.

**Example Usage:**
```typescript
// Resets on mousemove, keydown, click, touchstart
const autoLock = new AutoLockService(() => {
    document.dispatchEvent(new CustomEvent('lock-vault'));
});
autoLock.start();
```

---

## 🛠️ Specialized Tools

### 1. Advanced Password Generator
Supports multiple strategies for different security needs.

| Strategy | Example Result | Use Case |
|----------|----------------|----------|
| **Standard** | `z8$K!mP9Q#2v` | High randomness, max security |
| **Mac OS Style** | `abc12x-def45y-ghi78z` | Human-readable, easy to type |
| **Passphrase** | `azure-tiger-vivid-pearl` | Memorable, high entropy |

### 2. Security Auditing (`SecurityScanner`)
- **XSS Prevention**: Sanitizes all user-facing strings (Service Name, Username).
- **Breach Check**: Uses k-anonymity (SHA-1 prefix) to check the "Have I Been Pwned" API without exposing the full password.
- **Entropy Calculation**: `L * log2(R)` to provide real-time strength labels.

---

## 🧪 Testing Strategy

We maintain a **100% pass rate** across 70+ tests using **Vitest**.

- **Unit Tests**: `crypto.test.ts`, `password.test.ts`, `VaultState.test.ts`.
- **Service Tests**: `AutoLockService.test.ts`, `VaultUnlockService.test.ts`.

### Running Tests
```bash
npm test          # Launch watch mode
npm run build     # Includes type checking and production bundling
```

---

## 📁 Data Schema

### Vault Entry (`VaultEntry`)
```typescript
{
    id: string;              // UUID v4
    title: string;           // Sanitized service name
    username?: string;       // Optional identity
    password: string;        // Encrypted secret
    category: string;        // all|work|personal|finance|social|other
    totpSecret?: string;     // Base32 for 2FA
    favorite?: boolean;      // Starring flag
    history?: string[];      // Last 5 passwords
}
```

### Storage Slots (`localStorage`)
- `encrypted_vault`: Main encrypted payload (AES-GCM).
- `decoy_vault`: Decoy encrypted payload.
- `vault_salt`: 256-bit salt for key derivation.
- `bio_wrapped_password`: Master password encrypted with Biometric wrapping key.
