# Security Improvements Log

## 2026-01-08: Per-User Salt Generation

### Problem
Previously, the application used a hardcoded salt value:
```typescript
const SALT = new Uint8Array([42, 17, 89, 4, 255, 12, 0, 33]);
```

This created a significant security vulnerability:
- If the source code was exposed, attackers could pre-compute rainbow tables for all users
- All users shared the same salt, making mass attacks more efficient
- Violated cryptographic best practices for key derivation

### Solution
Implemented per-user salt generation:
- Each vault now generates a unique 256-bit (32-byte) cryptographically secure salt
- Main vault salt stored at `vault_salt` in localStorage
- Duress vault salt stored at `decoy_salt` in localStorage
- Salts are not secret and are stored unencrypted (this is standard practice)

### Implementation Details

**Salt Generation:**
```typescript
function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32)); // 256-bit salt
}
```

**Salt Storage Keys:**
- `vault_salt` - Main vault's unique salt
- `decoy_salt` - Duress vault's unique salt

**Key Derivation:**
- Uses PBKDF2 with SHA-256
- 100,000 iterations (unchanged)
- Now with unique per-user salt

### Migration Notes

**IMPORTANT:** Existing vaults created before this update will not work!

Users with existing vaults need to:
1. Export their data (if export functionality exists)
2. Clear localStorage
3. Reinitialize vault with new master password
4. Re-import data

### Security Benefits
1. **Rainbow Table Prevention**: Each user has unique salt, making pre-computation attacks impractical
2. **Parallel Attack Mitigation**: Attackers must attack each vault individually
3. **Best Practice Compliance**: Follows NIST SP 800-132 guidelines for password-based key derivation
4. **Increased Entropy**: 256-bit salt provides strong randomness

### Testing
- Build succeeds without errors
- Both main vault and duress vault use separate salts
- Salt generation uses cryptographically secure random number generator

### Future Considerations
- Consider increasing PBKDF2 iterations to 310,000 (OWASP 2023 recommendation)
- Add vault migration utility for users with existing vaults
- Consider using Argon2id instead of PBKDF2 (more resistant to GPU attacks)

---

## 2026-01-08: Biometric Security Enhancement

### Problem
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

### Solution
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

### Implementation Details

**Registration (Secure):**
```typescript
// Requires vault to be already unlocked
if (!sessionKey) {
    return alert("Please unlock your vault first");
}
// Store only credential ID - NO password stored
localStorage.setItem('bio_credential_id', credentialId);
localStorage.setItem('bio_registered', 'true');
// NO password storage: bio_wrapped_pwd removed completely
```

**Authentication Flow:**
```typescript
// 1. Verify biometric identity
await navigator.credentials.get({...});

// 2. Prompt for password (NOT stored)
const pwd = prompt("Biometric verified! Enter password:");

// 3. Normal unlock flow
unlock(pwd);
```

### Security Benefits
1. **Zero Password Storage**: Master password never stored, even encrypted
2. **Two-Factor Approach**: Biometric (something you are) + Password (something you know)
3. **WebAuthn Security**: Uses hardware-backed authentication
4. **User Verification**: Requires `userVerification: "required"` flag
5. **True Zero-Knowledge**: Maintains zero-knowledge architecture

### Breaking Changes
- Old biometric registrations will not work (must re-register)
- Removes `bio_wrapped_pwd` from localStorage
- User must enter password after biometric verification

### User Experience
**Before:**
- Touch fingerprint → Auto-unlock (insecure)

**After:**
- Touch fingerprint → Verified! → Enter password → Unlock (secure)

### Why This is Better
While requiring password entry after biometric might seem less convenient:
- It's genuinely secure (old method was security theater)
- Provides real two-factor authentication
- Maintains zero-knowledge architecture
- Prevents password theft via localStorage access
- Aligns with security best practices

### Alternative Considered: Web Crypto Key Wrapping
We could use `crypto.subtle.wrapKey()` to encrypt the password, but this has issues:
- Wrapping key must be stored somewhere (same problem)
- Complexity doesn't add real security
- Current approach is simpler and more secure

### Recommendation
Consider adding an "auto-lock timer" feature to reduce password entry frequency while maintaining security.
