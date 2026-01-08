/**
 * Vault Unlock Service
 * Handles vault decryption and unlock logic
 * Supports both real vault and decoy/duress vault
 */

import { CryptoEngine } from '../crypto.js';
import { getSalt } from '../utils/crypto-utils.js';

export interface UnlockResult {
    success: boolean;
    vault: { entries: any[] } | null;
    sessionKey: CryptoKey | null;
    isDecoyMode: boolean;
    error?: string;
}

export class VaultUnlockService {
    /**
     * Attempt to unlock vault with given password
     * Tries real vault first, then decoy vault if available
     *
     * @param password - Master password to unlock vault
     * @returns UnlockResult with vault data and metadata
     */
    static async unlock(password: string): Promise<UnlockResult> {
        if (!password) {
            return {
                success: false,
                vault: null,
                sessionKey: null,
                isDecoyMode: false,
                error: "Password is required"
            };
        }

        const real = localStorage.getItem('encrypted_vault');
        const decoy = localStorage.getItem('decoy_vault');

        // Try to decrypt real vault first
        if (real) {
            const realResult = await this.tryDecrypt(password, real, 'vault_salt', false);
            if (realResult.success) {
                return realResult;
            }
        }

        // If real vault fails, try decoy vault
        if (decoy) {
            const decoyResult = await this.tryDecrypt(password, decoy, 'decoy_salt', true);
            if (decoyResult.success) {
                return decoyResult;
            }
        }

        // If no vaults exist yet, return failure
        if (!real && !decoy) {
            return {
                success: false,
                vault: null,
                sessionKey: null,
                isDecoyMode: false,
                error: "No vault found. Please create a vault first."
            };
        }

        // Password didn't match any vault
        return {
            success: false,
            vault: null,
            sessionKey: null,
            isDecoyMode: false,
            error: "Incorrect password"
        };
    }

    /**
     * Try to decrypt a vault with given password
     * @private
     */
    private static async tryDecrypt(
        password: string,
        encryptedVault: string,
        saltKey: string,
        isDecoy: boolean
    ): Promise<UnlockResult> {
        try {
            const salt = getSalt(saltKey);
            const key = await CryptoEngine.deriveKey(password, salt);
            const { iv, data } = JSON.parse(encryptedVault);
            const decrypted = await CryptoEngine.decrypt(
                new Uint8Array(data).buffer,
                key,
                new Uint8Array(iv)
            );
            const vault = JSON.parse(decrypted);

            return {
                success: true,
                vault,
                sessionKey: key,
                isDecoyMode: isDecoy
            };
        } catch (error) {
            return {
                success: false,
                vault: null,
                sessionKey: null,
                isDecoyMode: false,
                error: "Decryption failed"
            };
        }
    }

    /**
     * Check if vault is initialized
     */
    static isVaultInitialized(): boolean {
        return localStorage.getItem('vault_initialized') === 'true';
    }

    /**
     * Check if decoy vault exists
     */
    static hasDecoyVault(): boolean {
        return !!localStorage.getItem('decoy_vault');
    }
}
