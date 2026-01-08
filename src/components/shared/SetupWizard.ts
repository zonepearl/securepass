/**
 * Setup Wizard Component
 * Handles initial vault creation and onboarding
 */

import { BaseComponent } from '../BaseComponent.js';
import { WasmCryptoService } from '../../services/WasmCryptoService.js';
import { BackupService } from '../../utils/backup.js';
import { showToast } from './ToastNotification.js';

export class SetupWizard extends BaseComponent {
    protected render(): void {
        this.innerHTML = `
            <div id="wizard-modal" class="modal-overlay hidden">
                <div class="modal-content">
                    <div id="step-1" class="wizard-step">
                        <h2 style="margin-top: 0;">Welcome to WebVault 🛡️</h2>
                        <p>This is a <strong>Zero-Knowledge</strong> application designed by <strong>Pearl Young</strong>.</p>
                        <p style="font-size: 14px; line-height: 1.5; opacity: 0.8;">
                            We cannot recover your password. If you lose it, your data is gone forever. Please use a password
                            you will never forget.
                        </p>
                        <button id="wizard-next-btn" class="btn-primary" style="width: 100%; margin-top: 20px;">
                            I Accept the Responsibility
                        </button>
                        <div style="text-align: center; margin-top: 16px;">
                            <a href="#" id="restore-link" style="font-size: 13px; color: var(--primary);">
                                Or Restore from Backup
                            </a>
                            <input type="file" id="restore-file" style="display: none;" accept=".json">
                        </div>
                    </div>

                    <div id="step-2" class="wizard-step hidden">
                        <h2 style="margin-top: 0;">Create Master Key</h2>
                        <p style="font-size: 14px; opacity: 0.8;">Set your primary password (Min. 12 characters).</p>
                        <input type="password" id="setup-pwd" placeholder="New Master Password">
                        <input type="password" id="setup-pwd-conf" placeholder="Confirm Password">
                        <button id="wizard-finish-btn" class="btn-primary" style="width: 100%; margin-top: 20px;">
                            Create My Vault
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    protected attachEventListeners(): void {
        // Next button (step 1 → step 2)
        const nextBtn = this.querySelector('#wizard-next-btn');
        nextBtn?.addEventListener('click', () => this.goToStep(2));

        // Finish button (create vault)
        const finishBtn = this.querySelector('#wizard-finish-btn');
        finishBtn?.addEventListener('click', () => this.handleFinishSetup());

        // Restore link
        const restoreLink = this.querySelector('#restore-link');
        const fileInput = this.querySelector('#restore-file') as HTMLInputElement;

        restoreLink?.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput?.click();
        });

        // File Selection
        fileInput?.addEventListener('change', async () => {
            if (fileInput.files && fileInput.files[0]) {
                try {
                    await BackupService.importBackup(fileInput.files[0]);
                    showToast("Backup restored! Please unlock with your original password.", 'success');
                    location.reload();
                } catch (error) {
                    showToast((error as Error).message, 'error');
                }
            }
        });
    }

    /**
     * Navigate to a specific wizard step
     */
    private goToStep(step: number): void {
        this.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
        const targetStep = this.querySelector(`#step-${step}`);
        if (targetStep) targetStep.classList.remove('hidden');
    }

    /**
     * Generate a cryptographically secure random salt
     */
    private generateSalt(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(32)); // 256-bit salt
    }

    /**
     * Handle vault creation
     */
    private async handleFinishSetup(): Promise<void> {
        const p1 = (this.querySelector('#setup-pwd') as HTMLInputElement).value;
        const p2 = (this.querySelector('#setup-pwd-conf') as HTMLInputElement).value;

        if (p1.length < 12) {
            showToast("Security Requirement: Master Password must be at least 12 characters.", 'error');
            return;
        }
        if (p1 !== p2) {
            showToast("Passwords do not match.", 'error');
            return;
        }

        try {
            const initialVault = { entries: [] };

            // Generate unique salt for this vault
            const salt = this.generateSalt();
            const bridge = await WasmCryptoService.createBridge(p1, salt);

            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ciphertext = WasmCryptoService.encrypt(bridge, JSON.stringify(initialVault), iv);

            // Store encrypted vault
            localStorage.setItem('encrypted_vault', JSON.stringify({
                iv: Array.from(iv),
                data: Array.from(ciphertext)
            }));

            // Store salt separately (unencrypted - salt is not secret)
            localStorage.setItem('vault_salt', JSON.stringify(Array.from(salt)));
            localStorage.setItem('vault_initialized', 'true');

            showToast("Vault created successfully! Please log in with your new password.", 'success');

            // Dispatch event for completion
            this.dispatchEvent(new CustomEvent('wizard-completed', {
                bubbles: true,
                composed: true
            }));

            location.reload();
        } catch (e) {
            showToast("Setup failed. Ensure your browser supports WebCrypto.", 'error');
        }
    }

    /**
     * Show the wizard modal
     */
    public show(): void {
        const modal = this.querySelector('#wizard-modal');
        modal?.classList.remove('hidden');
        this.goToStep(1); // Start at step 1
    }

    /**
     * Hide the wizard modal
     */
    public hide(): void {
        const modal = this.querySelector('#wizard-modal');
        modal?.classList.add('hidden');
    }

    protected onStateChange(): void {
        // Wizard doesn't need to react to vault state changes
    }
}

// Register the custom element
customElements.define('setup-wizard', SetupWizard);
