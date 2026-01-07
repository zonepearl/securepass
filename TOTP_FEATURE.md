# TOTP (Time-based One-Time Password) Feature Documentation

## Overview
WebVault includes full support for storing and generating TOTP (2FA) codes, allowing users to manage both passwords and two-factor authentication codes in one secure location.

## Features

### 1. TOTP Secret Storage
- **Optional Field**: TOTP secrets are completely optional per entry
- **Base32 Validation**: Automatic validation of TOTP secret format
- **Auto-formatting**: Input field automatically converts to uppercase
- **Encrypted Storage**: TOTP secrets are encrypted with the vault (AES-GCM 256-bit)

### 2. Live TOTP Code Generation
- **Real-time Generation**: Codes update automatically every 30 seconds
- **Visual Countdown**: Timer shows seconds remaining until next code
- **Formatted Display**: Codes displayed as "XXX XXX" for easy reading
- **Error Handling**: Invalid secrets show "Invalid Secret" instead of breaking

### 3. Standard Compatibility
- **RFC 6238 Compliant**: Follows TOTP standard specification
- **Compatible Secrets**: Works with secrets from:
  - Google Authenticator
  - Authy
  - Microsoft Authenticator
  - 1Password
  - Any RFC 6238 compliant app

## Implementation Details

### Code Generation Algorithm
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

### Base32 Validation
```typescript
function isValidBase32(str: string): boolean {
    // Base32 alphabet: A-Z (uppercase) and 2-7
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(str) && str.length > 0;
}
```

### Security Features
1. **Encrypted at Rest**: TOTP secrets stored encrypted in vault
2. **No Cloud Sync**: Secrets never leave the device
3. **Memory Safety**: Codes regenerated from secret (not cached)
4. **Secure Display**: Codes only visible when vault is unlocked

## User Guide

### How to Add TOTP to an Entry

1. **Get Your TOTP Secret**:
   - When setting up 2FA on a service, look for "Can't scan QR code?" or "Manual entry"
   - Copy the secret key (usually a Base32 string like `JBSWY3DPEHPK3PXP`)

2. **Add to WebVault**:
   - Create or edit a vault entry
   - Paste the secret in the "2FA Secret (Optional - Base32)" field
   - Click "Add to Vault" or "Update Entry"

3. **Save Your Vault**:
   - Click "Encrypt & Save Vault" to persist changes

4. **Use the Code**:
   - The 6-digit code appears in the entry card
   - Enter this code when the service prompts for 2FA
   - Code refreshes automatically every 30 seconds

### Example TOTP Secrets (for testing)

```
JBSWY3DPEHPK3PXP
GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
MFRGGZDFMZTWQ2LK
```

## UI Components

### Input Field
```html
<input
    type="text"
    id="totp-secret"
    placeholder="2FA Secret (Optional - Base32)"
    style="text-transform: uppercase;">
```

### Display Card (when TOTP exists)
```html
<div style="...">
    <div>
        <span>🔐 2FA CODE</span>
        <span class="totp-timer">⏱️ 25s</span>
    </div>
    <div class="totp-code">123 456</div>
</div>
```

## Technical Specifications

| Property | Value |
|----------|-------|
| Algorithm | SHA-1 (HMAC-SHA1) |
| Code Length | 6 digits |
| Time Step | 30 seconds |
| Format | Base32 encoding |
| Standard | RFC 6238 |
| Library | OTPAuth v9.4.1 |

## Error Handling

### Invalid Secret
If an invalid Base32 string is entered:
```
Alert: "Invalid 2FA Secret. Please use a valid Base32 string (A-Z, 2-7)."
```

### Malformed Secret (at display time)
If the secret is stored but can't generate code:
```
Display: "Invalid Secret" (instead of throwing error)
Timer: "0s"
```

## Storage Format

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

## Performance Considerations

### Memory Leak Prevention
```typescript
// Cleanup interval when card is removed from DOM
card.addEventListener('DOMNodeRemoved', () => {
    clearInterval(interval);
});
```

### Efficient Updates
- TOTP codes update every 1 second (for countdown accuracy)
- Each entry manages its own update interval
- No global timer (prevents unnecessary updates for hidden entries)

## Browser Compatibility

**Required APIs:**
- `crypto.getRandomValues()` ✓ (for Base32 secret validation)
- Standard JavaScript Date/Time ✓
- OTPAuth library ✓

**Supported Browsers:**
- Chrome/Edge 60+
- Firefox 55+
- Safari 11+
- All modern mobile browsers

## Migration from Other Apps

### From Google Authenticator
1. Open Google Authenticator
2. Tap the three dots → Transfer accounts → Export accounts
3. View the QR code on another device running a QR scanner
4. Extract the secret from the `otpauth://` URL
5. Add to WebVault

### From Authy
1. Authy does not allow secret export (by design)
2. Must disable 2FA on service and re-enable
3. During re-enable, capture the secret key
4. Add to both Authy and WebVault

### From 1Password/Bitwarden
1. Export vault (includes TOTP secrets in plaintext)
2. Extract secrets from export file
3. Import into WebVault manually
4. Delete export file securely

## Limitations

1. **No QR Code Scanning**: Must enter secret manually (QR scanning requires camera API)
2. **No Export**: TOTP secrets cannot be exported separately from vault
3. **No Backup Codes**: Does not generate/store backup codes (store those separately)
4. **SHA-1 Only**: Currently only supports SHA-1 (most common, but some services use SHA-256/SHA-512)

## Future Enhancements

### Potential Improvements
- [ ] QR code scanning support (using camera API)
- [ ] Support for SHA-256 and SHA-512 algorithms
- [ ] Support for 8-digit codes (some banks use this)
- [ ] Steam Guard compatibility (custom TOTP variant)
- [ ] Copy code to clipboard button
- [ ] Show/hide TOTP codes by default (for privacy)
- [ ] TOTP secret generation for users creating new 2FA

## Security Considerations

### ✅ Secure Practices
- TOTP secrets encrypted at rest
- Codes generated on-demand (not cached)
- Validation prevents injection attacks
- No network transmission of secrets

### ⚠️ Important Notes
- **Single Point of Failure**: Storing passwords AND TOTP in same vault reduces 2FA effectiveness
- **Recommendation**: Consider keeping TOTP in separate app for true two-factor security
- **Use Case**: Best for accounts where convenience matters more than maximum security

## Testing

### Manual Test Procedure
1. Add entry with valid TOTP secret: `JBSWY3DPEHPK3PXP`
2. Verify code appears and updates
3. Verify timer counts down from 30 to 1
4. Verify code changes after timer reaches 0
5. Test with invalid secret: `INVALID123`
6. Verify validation error appears
7. Edit entry and remove TOTP secret
8. Verify TOTP section disappears
9. Lock and unlock vault
10. Verify TOTP codes still generate correctly

## Support

For issues or questions:
- Check Base32 format (A-Z, 2-7, no spaces)
- Verify secret is from a TOTP-compatible service
- Ensure service uses standard 30-second interval
- Test with known working secret (see examples above)
