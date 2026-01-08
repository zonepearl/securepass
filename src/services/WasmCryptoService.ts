import init, { CryptoBridge, derive_bio_key, wrap_password, unwrap_password } from '../pkg/securepass_wasm.js';

export class WasmCryptoService {
    private static initialized = false;

    /**
     * Initialize the Wasm module.
     * Must be called once before any other operations.
     */
    static async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await init();
            this.initialized = true;
        }
    }

    /**
     * Create a new CryptoBridge instance with Argon2id key derivation.
     * @param password Master password
     * @param salt Vault salt
     */
    static async createBridge(password: string, salt: Uint8Array): Promise<CryptoBridge> {
        await this.ensureInitialized();
        return new CryptoBridge(password, salt);
    }

    /**
     * Helper to encrypt data using the provided bridge.
     */
    static encrypt(bridge: CryptoBridge, plaintext: string, iv: Uint8Array): Uint8Array {
        return bridge.encrypt(plaintext, iv);
    }

    /**
     * Helper to decrypt data using the provided bridge.
     */
    static decrypt(bridge: CryptoBridge, ciphertext: Uint8Array, iv: Uint8Array): string {
        return bridge.decrypt(ciphertext, iv);
    }

    /**
     * Generate a secure password.
     */
    static generatePassword(bridge: CryptoBridge, length: number, useUppercase: boolean, useNumbers: boolean, useSymbols: boolean): string {
        return bridge.generate_password({
            length,
            use_uppercase: useUppercase,
            use_numbers: useNumbers,
            use_symbols: useSymbols
        } as any);
    }

    /**
     * Generate a Mac-style password.
     */
    static generateMacPassword(bridge: CryptoBridge): string {
        return bridge.generate_mac_password();
    }

    /**
     * Generate a memorable passphrase.
     */
    static generatePassphrase(bridge: CryptoBridge): string {
        return bridge.generate_passphrase();
    }

    /**
     * Get the current TOTP code for a secret.
     */
    static getTotpCode(bridge: CryptoBridge, secret: string): string {
        return bridge.get_totp_code(secret);
    }

    /**
     * Rotate password history.
     */
    static rotateHistory(bridge: CryptoBridge, currentPassword: string, history: string[]): string[] {
        const historyJson = JSON.stringify(history);
        const newHistoryJson = bridge.rotate_history(currentPassword, historyJson);
        return JSON.parse(newHistoryJson);
    }

    /**
     * Derive a 256-bit key from a bio credential ID using Argon2id.
     */
    static async deriveBioKey(credentialId: Uint8Array): Promise<Uint8Array> {
        await this.ensureInitialized();
        return derive_bio_key(credentialId);
    }

    /**
     * Wrap a password using a bio key.
     */
    static async wrapPassword(password: string, bioKey: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
        await this.ensureInitialized();
        return wrap_password(password, bioKey, iv);
    }

    /**
     * Unwrap a password using a bio key.
     */
    static async unwrapPassword(wrappedData: Uint8Array, bioKey: Uint8Array, iv: Uint8Array): Promise<string> {
        await this.ensureInitialized();
        return unwrap_password(wrappedData, bioKey, iv);
    }
}
