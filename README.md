# 🔐 SecurePass: Zero-Knowledge Password Manager

SecurePass is a next-generation, browser-based password manager engineered on a Zero-Knowledge foundation. It achieves elite performance and memory security by offloading all cryptographic heavy lifting to a Rust-powered WebAssembly (Wasm) engine, while utilizing TypeScript for a fluid and responsive user experience.

By isolating sensitive operations like Argon2id key derivation, AES-256-GCM encryption, and high-precision TOTP generation within the Wasm sandbox, SecurePass ensures that master keys never touch the JavaScript heap in plaintext. Beyond its hardened core, the platform offers a premium "Modern Sky" interface featuring biometric passkey unlocking, a stealthy Duress Mode decoy vault, a smart entropy engine with guaranteed character diversity, and a real-time security dashboard for comprehensive vault health monitoring.

---

## 📸 Overview

<p align="center">
  <img src="assets/WebVault-light-mode.png" alt="WebVault Light Mode" width="45%" />
  <img src="assets/WebVault-dark-mode.png" alt="WebVault Dark Mode" width="45%" />
</p>

---

*   **💎 Modern Sky UI**: A professional, high-end minimalist interface optimized for light and dark modes.
*   **🛡️ Zero-Knowledge**: Your master password never leaves your device.
*   **☝️ Biometric Unlock**: Modern Passkey support (WebAuthn). Cryptographic wrapping is handled in **Rust/Wasm** for maximum memory safety.
*   **🎭 Duress Mode**: A "Panic Password" unlocks a fake decoy vault if you are forced to open it.
*   **🔐 Built-in 2FA (Wasm)**: Generate high-precision TOTP codes directly in the vault using a Rust-Wasm engine.
*   **🎲 Smart Generator**: High-entropy password generation that **guarantees** character diversity (Upper, Lower, Number, Symbol).
*   **📥 Backup & Restore**: Export encrypted JSON backups to keep your data safe.
*   **📊 Security Dashboard**: Real-time vault health analytics and breach detection powered by Wasm.
*   **📝 Encrypted Notes**: Store private metadata securely alongside your passwords.
*   **🔍 Breach Detection**: Real-time privacy-preserving checks against compromised databases.

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
*   **Node.js** (v18+) & **npm**
*   **Rust** (Latest Stable): [Install Rust](https://www.rust-lang.org/tools/install)
*   **wasm-pack**: [Install wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

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

## 📖 Developer & Technical Documentation

For detailed architecture, security models, cryptographic specifications, and testing protocols, please refer to:

👉 **[DEVELOPER_MANUAL.md](./DEVELOPER_MANUAL.md)** — Includes a **[Rust-to-Wasm Journey](./DEVELOPER_MANUAL.md#️-the-journey-from-rust-to-typescript)** guide for beginners! 🦀  
👉 **[src-wasm/README.md](./src-wasm/README.md)** — Logic Tier Architecture & Seqeunce Diagrams.

---

## 📦 Tech Stack

*   **Languages**: TypeScript, Rust
*   **Architecture**: Wasm Cryptographic Bridge (Isolated Logic Tier)
*   **Bundler**: Vite
*   **Crypto**: Argon2id (KDF), AES-256-GCM (Cipher), totp-rs
*   **Tooling**: wasm-pack, wasm-bindgen
*   **Tests**: Vitest, Rust `#[test]`
*   **Styles**: Modern CSS / Glassmorphism (Light/Dark Mode)

---

## 📄 License

MIT License.
