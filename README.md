# 🔐 SecurePass: Zero-Knowledge Password Manager

SecurePass is a high-security, browser-based password manager built on a **Zero-Knowledge** architecture. Your data is encrypted locally (AES-GCM 256-bit) on your device, and only you hold the key to unlock it.

---

## 📸 Overview

<p align="center">
  <img src="assets/WebVault-light-mode.png" alt="WebVault Light Mode" width="45%" />
  <img src="assets/WebVault-dark-mode.png" alt="WebVault Dark Mode" width="45%" />
</p>

---

*   **💎 Modern Sky UI**: A professional, high-end minimalist interface optimized for light and dark modes.
*   **🛡️ Zero-Knowledge**: Your master password never leaves your device.
*   **☝️ Biometric Unlock**: Use TouchID/FaceID (WebAuthn) for secure, passwordless access.
*   **🎭 Duress Mode**: A "Panic Password" unlocks a fake decoy vault if you are forced to open it.
*   **🔐 Built-in 2FA**: Generate TOTP codes for your accounts directly in the vault.
*   **📥 Backup & Restore**: Export encrypted JSON backups to keep your data safe.
*   **🔍 Breach Detection**: Real-time privacy-preserving checks against compromised databases.

---

## 🚀 Getting Started

### Installation

1.  **Clone the repository**:
    ```bash
    git clone git@github.com:zonepearl/keepassman.git
    cd keepassman
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run development server**:
    ```bash
    npm run dev
    ```
4.  **Build for production**:
    ```bash
    npm run build
    ```

---

## 📖 User Guide

### 1. Initial Setup
*   Create a strong **Master Password** (Min 12 chars).
*   This password is the *only* way to decrypt your data. **Do not lose it.**

### 2. Enabling Biometrics (Passkeys)
*   Go to **Security Hub** (Sidebar footer or Toolbar).
*   Click **Link Biometrics**.
*   Verify with your device (TouchID/FaceID).
*   *Note: Taking this action allows you to unlock the vault without typing your password each time.*

### 3. Setting Up Duress Mode
*   Go to **Configure Duress** in the sidebar.
*   Set a **Panic Password** (different from your Master Password).
*   **How to use**: If someone forces you to unlock your vault, type the *Panic Password* at the login screen. It will stealthily unlock a fake vault with dummy data.

### 4. Backup & Restore
*   **Backup**: Click the **Exit/Export** button -> **Export Backup**. Safe to store anywhere (it's encrypted).
*   **Restore**: on the Login/Setup screen, click **Restore from Backup** and select your JSON file.

---

## 🛠️ Developer & Technical Documentation

For detailed architecture, security models, cryptographic specifications, and testing protocols, please refer to:

👉 **[DEVELOPER_MANUAL.md](./DEVELOPER_MANUAL.md)**

---

## 📦 Tech Stack

*   **Language**: TypeScript
*   **Bundler**: Vite
*   **Crypto**: Native Web Crypto API (AES-GCM, PBKDF2, SHA-256)
*   **Tests**: Vitest
*   **Styles**: Modern CSS Variables (Light/Dark Mode)

---

## 📄 License

MIT License.
