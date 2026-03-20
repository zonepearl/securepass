/**
 * Password Generator Modal
 * Standalone generator accessible from the main toolbar.
 * Reuses the same WasmCryptoService generation logic as the entry side panel.
 */

import { BaseComponent } from '../BaseComponent.js';
import { vaultState } from '../../state/VaultState.js';
import { showToast } from './ToastNotification.js';
import { WasmCryptoService } from '../../services/WasmCryptoService.js';

export class PasswordGeneratorModal extends BaseComponent {
    protected render(): void {
        // Modal structure lives in index.html; this component manages behaviour only
    }

    protected attachEventListeners(): void {
        // Close via ✕ button
        document.getElementById('pg-close-btn')
            ?.addEventListener('click', () => this.close());

        // Close by clicking the overlay background (stop propagation on inner content)
        document.getElementById('pg-modal')
            ?.addEventListener('click', () => this.close());
        document.getElementById('pg-modal-inner')
            ?.addEventListener('click', (e) => e.stopPropagation());

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('pg-modal');
                if (modal && !modal.classList.contains('hidden')) this.close();
            }
        });

        // Regenerate button
        document.getElementById('pg-regen-btn')
            ?.addEventListener('click', () => this.generate());

        // Copy button
        document.getElementById('pg-copy-btn')
            ?.addEventListener('click', () => this.copyPassword());

        // Format selector
        const genType = document.getElementById('pg-gen-type') as HTMLSelectElement;
        const stdOptions = document.getElementById('pg-std-options');
        genType?.addEventListener('change', () => {
            if (genType.value === 'standard') {
                stdOptions?.classList.remove('hidden');
            } else {
                stdOptions?.classList.add('hidden');
            }
            this.generate();
        });

        // Length slider
        const lenSlider = document.getElementById('pg-length') as HTMLInputElement;
        const lenVal = document.getElementById('pg-length-val');
        lenSlider?.addEventListener('input', () => {
            if (lenVal) lenVal.textContent = lenSlider.value;
            this.generate();
        });

        // Option checkboxes
        ['pg-upper', 'pg-numbers', 'pg-symbols'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.generate());
        });
    }

    private generate(): void {
        const output = document.getElementById('pg-output') as HTMLInputElement;
        const genType = (document.getElementById('pg-gen-type') as HTMLSelectElement)?.value || 'standard';
        if (!output) return;

        const bridge = vaultState.getCryptoBridge();
        if (!bridge) {
            showToast("Vault not unlocked.", 'error');
            return;
        }

        if (genType === 'mac') {
            output.value = WasmCryptoService.generateMacPassword(bridge);
        } else if (genType === 'passphrase') {
            output.value = WasmCryptoService.generatePassphrase(bridge);
        } else {
            const length = parseInt(
                (document.getElementById('pg-length') as HTMLInputElement)?.value || '20', 10
            );
            const useUppercase = (document.getElementById('pg-upper') as HTMLInputElement)?.checked ?? true;
            const useNumbers = (document.getElementById('pg-numbers') as HTMLInputElement)?.checked ?? true;
            const useSymbols = (document.getElementById('pg-symbols') as HTMLInputElement)?.checked ?? true;
            output.value = WasmCryptoService.generatePassword(bridge, length, useUppercase, useNumbers, useSymbols);
        }
    }

    private copyPassword(): void {
        const output = document.getElementById('pg-output') as HTMLInputElement;
        if (!output?.value) {
            showToast("Generate a password first.", 'error');
            return;
        }
        navigator.clipboard.writeText(output.value);
        showToast("Password copied to clipboard.", 'success');
    }

    public open(): void {
        const modal = document.getElementById('pg-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        this.generate(); // Auto-generate a fresh password on open
    }

    private close(): void {
        document.getElementById('pg-modal')?.classList.add('hidden');
    }

    protected onStateChange(): void {
        // No state-driven re-render needed
    }
}

customElements.define('password-generator-modal', PasswordGeneratorModal);
