/**
 * Biometric Authentication Component
 * Handles biometric registration and unlock UI interactions
 */

import { BaseComponent } from '../BaseComponent.js';
import { BiometricService } from '../../services/BiometricService.js';
import { vaultState } from '../../state/VaultState.js';
import { showToast } from './ToastNotification.js';

export class BiometricAuth extends BaseComponent {
    protected render(): void {
        this.innerHTML = `
            <div id="bio-modal" class="modal-overlay hidden">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🛡️</div>
                    <h2 style="margin-top: 0;">Link Biometrics</h2>
                    <p style="font-size: 14px; opacity: 0.8; margin-bottom: 24px;">
                        Confirm your Master Password to link this device with <strong>TouchID / FaceID</strong> for passwordless unlock.
                    </p>
                    
                    <div class="form-group" style="text-align: left;">
                        <label class="label-caps">Confirm Master Password</label>
                        <input type="password" id="bio-confirm-pwd" placeholder="Master Password" style="margin-bottom: 0;">
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button id="bio-cancel-btn" class="btn-outline" style="flex: 1;">Cancel</button>
                        <button id="bio-confirm-btn" class="btn-primary" style="flex: 1;">Link Device</button>
                    </div>
                </div>
            </div>
        `;
    }

    protected attachEventListeners(): void {
        // Register biometric button (from sidebar)
        const registerBtn = document.getElementById('enable-bio-btn');
        registerBtn?.addEventListener('click', () => this.handleRegister());

        // Biometric unlock button (from auth screen)
        const unlockBtn = document.getElementById('bio-btn');
        unlockBtn?.addEventListener('click', () => this.handleUnlock());

        // Modal buttons
        this.querySelector('#bio-cancel-btn')?.addEventListener('click', () => this.closeModal());
        this.querySelector('#bio-confirm-btn')?.addEventListener('click', () => this.handleConfirm());
    }

    /**
     * Open the registration modal
     */
    private async handleRegister(): Promise<void> {
        // Check if vault is unlocked (cryptoBridge is available)
        const bridge = vaultState.getCryptoBridge();
        if (!bridge) {
            showToast("Please unlock your vault first before enabling biometrics.", 'error');
            return;
        }

        const modal = this.querySelector('#bio-modal');
        modal?.classList.remove('hidden');

        const pwdInput = this.querySelector('#bio-confirm-pwd') as HTMLInputElement;
        if (pwdInput) {
            pwdInput.value = '';
            pwdInput.focus();
        }
    }

    private closeModal(): void {
        const modal = this.querySelector('#bio-modal');
        modal?.classList.add('hidden');
    }

    /**
     * Handle the actual registration after password confirmation
     */
    private async handleConfirm(): Promise<void> {
        const pwdInput = this.querySelector('#bio-confirm-pwd') as HTMLInputElement;
        const masterPassword = pwdInput?.value;

        if (!masterPassword) {
            showToast("Please enter your master password.", 'error');
            return;
        }

        try {
            await BiometricService.register(masterPassword);
            showToast("✓ Passkey registered successfully!", 'success');

            this.closeModal();

            // Show bio button on auth screen for next time
            document.getElementById('bio-btn')?.classList.remove('hidden');
        } catch (error) {
            console.error("Biometric registration failed:", error);
            showToast((error as Error).message || "Passkey registration failed.", 'error');
        }
    }

    /**
     * Handle biometric unlock
     */
    private async handleUnlock(): Promise<void> {
        try {
            const masterPassword = await BiometricService.unlock();

            // Auto-fill password and trigger unlock
            const pwdInput = document.getElementById('master-pwd') as HTMLInputElement;
            if (pwdInput) {
                pwdInput.value = masterPassword;
                document.getElementById('unlock-btn')?.click();

                // Clear password from input after unlock attempt for security
                setTimeout(() => {
                    if (pwdInput) pwdInput.value = '';
                }, 100);
            }
        } catch (error) {
            console.warn("Passkey unlock failed or cancelled:", error);
            showToast((error as Error).message || "TouchID/FaceID authentication failed.", 'error');
        }
    }

    protected onStateChange(): void {
        // This component doesn't need to react to vault state changes
    }
}

// Register the custom element
customElements.define('biometric-auth', BiometricAuth);
