# 🔐 WebVault: Zero-Knowledge Password Manager

WebVault is a high-security, browser-based password manager built on a **Zero-Knowledge** architecture. This means your data is encrypted locally on your device, and only you hold the key to unlock it.

## 🌟 Key Features

### 🛡️ Zero-Knowledge Encryption
Your data is protected using **AES-GCM 256-bit** encryption. Your Master Password never leaves your browser; it is used to derive a local cryptographic key that stays in temporary memory.

### ☝️ Biometric Unlock (WebAuthn)
Once you have set your Master Password, you can link your device's fingerprint or FaceID. This uses the hardware-backed **WebAuthn API** to release your credentials securely without typing your password every time.

### 🎭 Duress (Stealth) Mode
WebVault includes a unique "Panic Password" feature. If you are forced to open your vault, entering your secondary **Duress Password** will unlock a completely separate, decoy vault containing fake data, protecting your real credentials.

### 📊 Security Audit & Entropy
The app automatically audits your passwords:
- **Entropy Check:** Warns you if a password is too simple or predictable.
- **Reuse Detection:** Identifies if you are using the same password for multiple accounts.

### 🔌 Offline-First
Designed to work entirely without internet. Your data is stored in your browser's local storage, ensuring access even during network outages.

---

## 🚀 How to Use
1. **Initialize:** Enter a strong Master Password.
2. **Add Entries:** Use the "Add Entry" form to store your accounts.
3. **Save:** Always click **Encrypt & Save** after making changes to persist data to your device.
4. **Secure:** Use the **Security Hub** to enable Biometrics or the Duress vault.