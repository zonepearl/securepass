/**
 * Cryptographic Engine for WebVault
 *
 * Provides AES-GCM 256-bit encryption with PBKDF2 key derivation
 * - Algorithm: AES-GCM (Authenticated Encryption)
 * - Key Derivation: PBKDF2 with SHA-256 (100,000 iterations)
 * - IV: 12-byte random nonce per encryption
 */
export const CryptoEngine = {
    ALGO: "AES-GCM" as const,

    async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                // Use 'as any' to bypass the SharedArrayBuffer check
                salt: salt as any,
                iterations: 100000,
                hash: "SHA-256",
            },
            baseKey,
            { name: this.ALGO, length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    async encrypt(data: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
            // Use 'as any' for the algorithm object to bypass the IV type check
            { name: this.ALGO, iv: iv as any },
            key,
            encoder.encode(data)
        );
        return { ciphertext, iv };
    },

    async decrypt(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
        const decrypted = await crypto.subtle.decrypt(
            // Use 'as any' for the algorithm object
            { name: this.ALGO, iv: iv as any },
            key,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    }
};
