import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultUnlockService } from './VaultUnlockService.js';
import { WasmCryptoService } from './WasmCryptoService.js';

// Mock Wasm and Service
vi.mock('../pkg/securepass_wasm.js', () => ({
    CryptoBridge: class {
        constructor() { }
    }
}));

vi.mock('./WasmCryptoService.js', () => ({
    WasmCryptoService: {
        createBridge: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn()
    }
}));

describe('VaultUnlockService', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should fail if no vault exists', async () => {
        const result = await VaultUnlockService.unlock('password');
        expect(result.success).toBe(false);
    });

    it('should unlock primary vault correctly', async () => {
        const password = 'correct-password';
        const salt = new Uint8Array(32);
        const iv = new Uint8Array(12);
        const encryptedData = { iv: Array.from(iv), data: [1, 2, 3] };
        const vault = { entries: [] };

        localStorage.setItem('vault_salt', JSON.stringify(Array.from(salt)));
        localStorage.setItem('encrypted_vault', JSON.stringify(encryptedData));

        const mockBridge = {} as any;
        (WasmCryptoService.createBridge as any).mockResolvedValue(mockBridge);
        (WasmCryptoService.decrypt as any).mockReturnValue(JSON.stringify(vault));

        const result = await VaultUnlockService.unlock(password);

        expect(result.success).toBe(true);
        expect(result.vault).toEqual(vault);
        expect(result.isDecoyMode).toBe(false);
        expect(WasmCryptoService.createBridge).toHaveBeenCalledWith(password, salt);
    });

    it('should unlock decoy vault correctly', async () => {
        const password = 'decoy-password';
        const salt = new Uint8Array(32);
        const iv = new Uint8Array(12);
        const encryptedDecoy = { iv: Array.from(iv), data: [1, 2, 3] };
        const vault = { entries: [{ id: '1', title: 'Decoy' }] };

        localStorage.setItem('vault_salt', JSON.stringify(Array.from(salt)));
        localStorage.setItem('decoy_vault', JSON.stringify(encryptedDecoy));
        localStorage.setItem('decoy_password_hash', 'mock-hash');

        const mockBridge = {} as any;
        (WasmCryptoService.createBridge as any).mockResolvedValue(mockBridge);
        (WasmCryptoService.decrypt as any).mockReturnValue(JSON.stringify(vault));

        const result = await VaultUnlockService.unlock(password);

        expect(result.success).toBe(true);
        expect(result.isDecoyMode).toBe(true);

        expect(result.success).toBe(true);
        expect(result.isDecoyMode).toBe(true);
    });

    it('should return failure on decryption error', async () => {
        const salt = new Uint8Array(32);
        localStorage.setItem('vault_salt', JSON.stringify(Array.from(salt)));
        localStorage.setItem('encrypted_vault', JSON.stringify({ iv: [], data: [] }));

        (WasmCryptoService.createBridge as any).mockResolvedValue({});
        (WasmCryptoService.decrypt as any).mockImplementation(() => { throw new Error('Decryption failed'); });

        const result = await VaultUnlockService.unlock('wrong-password');
        expect(result.success).toBe(false);
    });
});
