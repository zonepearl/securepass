/**
 * Entry Panel Component
 * Manages password entry creation and editing via a right-side slide-in panel
 */

import { BaseComponent } from '../BaseComponent.js';
import { vaultState } from '../../state/VaultState.js';
import { SecurityScanner } from '../../security.js';
import { checkPasswordBreach } from '../../utils/breach-check.js';
import { showToast } from '../shared/ToastNotification.js';
import { WasmCryptoService } from '../../services/WasmCryptoService.js';

interface EntryData {
    id?: string;
    title: string;
    username?: string;
    password: string;
    category?: string;
    totpSecret?: string;
    favorite?: boolean;
    history?: string[];
    notes?: string;
}

export class EntryModal extends BaseComponent {
    private editingEntry: EntryData | null = null;
    private closeTimeout: ReturnType<typeof setTimeout> | null = null;

    protected render(): void {
        // Panel structure lives in HTML; this component manages behaviour only
    }

    protected attachEventListeners(): void {
        // Close button (✕ in header)
        document.getElementById('panel-close-btn')
            ?.addEventListener('click', () => this.closePanel());

        // Cancel button (footer)
        document.getElementById('panel-cancel-btn')
            ?.addEventListener('click', () => this.closePanel());

        // Save button
        document.getElementById('panel-save-btn')
            ?.addEventListener('click', () => this.handleSaveEntry());

        // Backdrop click closes panel
        document.getElementById('entry-panel-backdrop')
            ?.addEventListener('click', () => this.closePanel());

        // Escape key closes panel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const panel = document.getElementById('entry-panel');
                if (panel && panel.classList.contains('open')) {
                    this.closePanel();
                }
            }
        });

        // Generate password button
        document.getElementById('gen-btn')
            ?.addEventListener('click', () => this.generateNewPassword());

        // Generator type change
        const genType = document.getElementById('gen-type') as HTMLSelectElement;
        const genStdOptions = document.getElementById('gen-std-options');
        genType?.addEventListener('change', () => {
            if (genType.value === 'standard') {
                genStdOptions?.classList.remove('hidden');
            } else {
                genStdOptions?.classList.add('hidden');
            }
            this.generateNewPassword();
        });

        // Live update for length slider
        const lenSlider = document.getElementById('gen-length') as HTMLInputElement;
        const lenVal = document.getElementById('gen-length-val');
        lenSlider?.addEventListener('input', () => {
            if (lenVal) lenVal.textContent = lenSlider.value;
            this.generateNewPassword();
        });

        // Generator option checkboxes
        ['gen-upper', 'gen-numbers', 'gen-symbols'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.generateNewPassword());
        });
    }

    /**
     * Generate password based on current UI settings
     */
    private generateNewPassword(): void {
        const pwdEl = document.getElementById('new-password') as HTMLInputElement;
        const genType = (document.getElementById('gen-type') as HTMLSelectElement)?.value || 'standard';

        if (!pwdEl) return;

        const bridge = vaultState.getCryptoBridge();
        if (!bridge) {
            showToast("Vault connection Error.", 'error');
            return;
        }

        if (genType === 'mac') {
            pwdEl.value = WasmCryptoService.generateMacPassword(bridge);
        } else if (genType === 'passphrase') {
            pwdEl.value = WasmCryptoService.generatePassphrase(bridge);
        } else {
            const length = parseInt((document.getElementById('gen-length') as HTMLInputElement)?.value || '20', 10);
            const useUppercase = (document.getElementById('gen-upper') as HTMLInputElement)?.checked ?? true;
            const useNumbers = (document.getElementById('gen-numbers') as HTMLInputElement)?.checked ?? true;
            const useSymbols = (document.getElementById('gen-symbols') as HTMLInputElement)?.checked ?? true;

            pwdEl.value = WasmCryptoService.generatePassword(bridge, length, useUppercase, useNumbers, useSymbols);
        }
    }

    /**
     * Open the side panel for creating or editing an entry
     */
    public openModal(entry?: EntryData): void {
        const panel = document.getElementById('entry-panel');
        const panelTitle = document.getElementById('panel-title');
        const saveBtn = document.getElementById('panel-save-btn') as HTMLButtonElement;
        const historySection = document.getElementById('history-section');
        const historyList = document.getElementById('history-list');

        if (!panel) return;

        // Cancel any in-progress close animation
        if (this.closeTimeout !== null) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = null;
        }

        if (entry) {
            // Edit mode
            this.editingEntry = entry;
            if (panelTitle) panelTitle.textContent = 'Edit Entry';
            if (saveBtn) saveBtn.textContent = 'Update Entry';

            (document.getElementById('entry-title') as HTMLInputElement).value = entry.title;
            (document.getElementById('entry-username') as HTMLInputElement).value = entry.username || '';
            (document.getElementById('new-password') as HTMLInputElement).value = entry.password;
            (document.getElementById('entry-category') as HTMLSelectElement).value = entry.category || 'personal';
            (document.getElementById('totp-secret') as HTMLInputElement).value = entry.totpSecret || '';
            (document.getElementById('entry-favorite') as HTMLInputElement).checked = !!entry.favorite;
            (document.getElementById('entry-notes') as HTMLTextAreaElement).value = entry.notes || '';

            // Render password history
            if (historySection && historyList) {
                if (entry.history && entry.history.length > 0) {
                    historySection.classList.remove('hidden');
                    historyList.innerHTML = entry.history.map(pwd => `
                        <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); font-family: monospace; font-size: 13px;">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;">${pwd}</span>
                            <button class="btn-outline history-copy" data-pwd="${pwd}" style="padding: 4px 8px; font-size: 11px;">Copy</button>
                        </div>
                    `).join('');

                    historyList.querySelectorAll('.history-copy').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const pwd = (e.currentTarget as HTMLElement).getAttribute('data-pwd');
                            if (pwd) {
                                navigator.clipboard.writeText(pwd);
                                showToast("Old password copied to clipboard.", 'success');
                            }
                        });
                    });
                } else {
                    historySection.classList.add('hidden');
                }
            }
        } else {
            // Create mode
            this.editingEntry = null;
            if (panelTitle) panelTitle.textContent = 'New Entry';
            if (saveBtn) saveBtn.textContent = 'Save Entry';

            (document.getElementById('entry-title') as HTMLInputElement).value = '';
            (document.getElementById('entry-username') as HTMLInputElement).value = '';
            (document.getElementById('new-password') as HTMLInputElement).value = '';
            (document.getElementById('entry-category') as HTMLSelectElement).value = 'personal';
            (document.getElementById('totp-secret') as HTMLInputElement).value = '';
            (document.getElementById('entry-favorite') as HTMLInputElement).checked = false;
            (document.getElementById('entry-notes') as HTMLTextAreaElement).value = '';

            if (historySection) historySection.classList.add('hidden');
        }

        // Reveal element, then trigger slide-in on next frame
        panel.classList.remove('hidden');
        requestAnimationFrame(() => {
            panel.classList.add('open');
            (document.getElementById('entry-title') as HTMLInputElement)?.focus();
        });

        this.dispatchEvent(new CustomEvent('modal-opened', {
            detail: { entry },
            bubbles: true,
            composed: true
        }));
    }

    /**
     * Slide the panel out, then hide it after the transition completes
     */
    private closePanel(): void {
        const panel = document.getElementById('entry-panel');
        if (!panel) return;

        panel.classList.remove('open');

        // Wait for the CSS transition (350ms) before setting display:none
        this.closeTimeout = setTimeout(() => {
            panel.classList.add('hidden');
            this.closeTimeout = null;
        }, 360);

        this.editingEntry = null;

        this.dispatchEvent(new CustomEvent('modal-closed', {
            bubbles: true,
            composed: true
        }));
    }

    /**
     * Handle saving entry with validation and security checks
     */
    private async handleSaveEntry(): Promise<void> {
        const titleEl = document.getElementById('entry-title') as HTMLInputElement;
        const usernameEl = document.getElementById('entry-username') as HTMLInputElement;
        const pwdEl = document.getElementById('new-password') as HTMLInputElement;
        const categoryEl = document.getElementById('entry-category') as HTMLSelectElement;
        const totpSecretEl = document.getElementById('totp-secret') as HTMLInputElement;
        const favoriteEl = document.getElementById('entry-favorite') as HTMLInputElement;
        const notesEl = document.getElementById('entry-notes') as HTMLTextAreaElement;

        if (!titleEl || !pwdEl || !titleEl.value || !pwdEl.value) {
            showToast("Service name and Password are required.", 'error');
            return;
        }

        try {
            // ========== ENHANCED SECURITY CHECKS ==========

            const sanitizedTitle = SecurityScanner.validateAndSanitize(titleEl.value, "Service name");
            const sanitizedUsername = usernameEl?.value
                ? SecurityScanner.validateAndSanitize(usernameEl.value, "Username")
                : '';

            if (SecurityScanner.detectXSS(pwdEl.value)) {
                showToast("Password contains potentially malicious content. Please use a different password.", 'error');
                return;
            }

            const totpSecret = totpSecretEl?.value.replace(/\s+/g, '').toUpperCase() || '';
            if (totpSecret) {
                const base32Validation = SecurityScanner.validateBase32(totpSecret);
                if (!base32Validation.isValid) {
                    showToast(`Invalid 2FA Secret: ${base32Validation.message}`, 'error');
                    return;
                }
            }

            const vault = vaultState.getVault();
            const duplicates = SecurityScanner.findDuplicatePasswords(
                vault.entries,
                pwdEl.value,
                this.editingEntry?.id
            );

            if (duplicates.length > 0) {
                const duplicateList = duplicates.join(', ');
                const message = `⚠️ Security Warning: Password Reuse Detected\n\n` +
                    `This password is already used in:\n${duplicateList}\n\n` +
                    `Reusing passwords across accounts is a security risk.\n\n` +
                    `Do you want to continue anyway?`;
                if (!confirm(message)) return;
            }

            const breachCount = await checkPasswordBreach(pwdEl.value);
            if (breachCount > 0) {
                const breachMessage = `⚠️ Data Breach Warning\n\n` +
                    `This password has been found in ${breachCount.toLocaleString()} data breaches.\n\n` +
                    `Using this password is highly insecure and puts your account at risk.\n\n` +
                    `Do you want to continue anyway? (Not recommended)`;
                if (!confirm(breachMessage)) return;
            }

            // ========== END SECURITY CHECKS ==========

            const entryData: EntryData = {
                id: this.editingEntry?.id || crypto.randomUUID(),
                title: sanitizedTitle,
                username: sanitizedUsername,
                password: pwdEl.value,
                category: categoryEl?.value || 'personal',
                totpSecret: totpSecret || undefined,
                favorite: favoriteEl?.checked || false,
                history: this.editingEntry?.history || [],
                notes: notesEl?.value || undefined
            };

            this.dispatchEvent(new CustomEvent('entry-saved', {
                detail: { entry: entryData, isEdit: !!this.editingEntry },
                bubbles: true,
                composed: true
            }));

            // Clear form fields
            titleEl.value = '';
            if (usernameEl) usernameEl.value = '';
            pwdEl.value = '';
            if (categoryEl) categoryEl.value = 'personal';
            if (totpSecretEl) totpSecretEl.value = '';
            if (favoriteEl) favoriteEl.checked = false;
            if (notesEl) notesEl.value = '';

            this.closePanel();

        } catch (error) {
            if (error instanceof Error) {
                showToast(`Security Error: ${error.message}`, 'error');
            } else {
                showToast("An error occurred while validating input. Please try again.", 'error');
            }
        }
    }

    protected onStateChange(): void {
        // Panel doesn't need to react to state changes
    }
}

// Register the custom element
customElements.define('entry-modal', EntryModal);
