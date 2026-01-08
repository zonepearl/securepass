import { BaseComponent } from '../BaseComponent.js';
import { WasmCryptoService } from '../../services/WasmCryptoService.js';
import { generateSalt } from '../../utils/crypto-utils.js';
import { showToast } from './ToastNotification.js';

export class DuressMode extends BaseComponent {
    constructor() {
        super();
    }

    protected render(): void {
        this.innerHTML = `
            <button id="setup-duress-btn" class="btn-outline" style="width: 100%; font-size: 12px; margin-bottom: 8px;">
                Configure Duress
            </button>
        `;
    }

    protected attachEventListeners(): void {
        const btn = this.querySelector('#setup-duress-btn');
        if (btn) {
            btn.addEventListener('click', this.setupDuress.bind(this));
        }
    }

    private async setupDuress(): Promise<void> {
        const dPwd = prompt("Set a secondary 'Panic' password (different from master):");
        if (!dPwd) return;

        if (dPwd.length < 12) {
            showToast("Duress password must be at least 12 characters.", 'error');
            return;
        }

        const decoy = { entries: [{ id: 'decoy-1', title: 'Fake Bank', password: 'password123', category: 'finance' }] };

        try {
            // Generate unique salt for duress vault
            const salt = generateSalt();
            const bridge = await WasmCryptoService.createBridge(dPwd, salt);

            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ciphertext = WasmCryptoService.encrypt(bridge, JSON.stringify(decoy), iv);

            // Store decoy vault and its salt
            localStorage.setItem('decoy_vault', JSON.stringify({
                iv: Array.from(iv),
                data: Array.from(ciphertext)
            }));
            localStorage.setItem('decoy_salt', JSON.stringify(Array.from(salt)));


            showToast("Duress Vault Ready. Log in with this password to show fake data.", 'success', 5000);
        } catch (error) {
            console.error("Error setting up duress mode:", error);
            showToast("Failed to setup Duress Mode.", 'error');
        }
    }
}

customElements.define('duress-mode', DuressMode);
