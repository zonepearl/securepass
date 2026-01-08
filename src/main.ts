
import { CryptoEngine } from './crypto.js';
import { vaultState } from './state/VaultState.js';
import { VaultUnlockService } from './services/VaultUnlockService.js';
import './components/index.js'; // Register all Web Components
import { showToast } from './components/shared/ToastNotification.js';
import { AutoLockService } from './services/AutoLockService.js';

let autoLockService: AutoLockService | null = null;







/**
 * 6. AUTHENTICATION & CORE EVENTS
 */
document.getElementById('unlock-btn')?.addEventListener('click', async () => {
    const pwdInput = document.getElementById('master-pwd') as HTMLInputElement;
    const pwd = pwdInput ? pwdInput.value : "";
    if (!pwd) return;

    try {
        const result = await VaultUnlockService.unlock(pwd);

        if (result.success) {
            // Update global state via Singleton
            vaultState.setVault(result.vault || { entries: [] });
            vaultState.setSessionKey(result.sessionKey);
            vaultState.setDecoyMode(result.isDecoyMode);

            // Switch to vault mode layout
            const app = document.getElementById('app');
            const main = document.querySelector('main');
            const footer = document.querySelector('footer');
            const header = document.querySelector('header');

            if (app) {
                app.classList.remove('auth-mode');
                app.classList.add('vault-mode');
            }
            if (main) {
                main.classList.remove('auth-view');
                main.classList.add('vault-view');
            }
            if (footer) {
                footer.classList.add('hidden');
            }
            if (header) {
                header.classList.add('hidden');
            }

            document.getElementById('auth-section')?.classList.add('hidden');
            document.getElementById('vault-content')?.classList.remove('hidden');
            if (result.isDecoyMode) document.getElementById('decoy-indicator')?.classList.remove('hidden');

            // Initialize Auto-lock
            if (!autoLockService) {
                autoLockService = new AutoLockService(() => {
                    document.dispatchEvent(new CustomEvent('lock-vault'));
                });
            }
            autoLockService.start();

            // Set initial value for auto-lock setting
            const lockSelect = document.getElementById('autolock-setting') as HTMLSelectElement;
            if (lockSelect && autoLockService) {
                lockSelect.value = autoLockService.getDuration().toString();
            }
        } else {
            showToast("Access Denied: Incorrect Master Password.", 'error');
        }
    } catch (error) {
        console.error("Unlock error:", error);
        showToast("Encryption Error.", 'error');
    }
});

/**
 * 7. EVENT BINDINGS
 */

// Listen for category-change events from VaultSidebar component
document.addEventListener('category-change', ((e: CustomEvent) => {
    vaultState.setCurrentCategory(e.detail.category);
}) as EventListener);

// Listen for edit-entry events from VaultTable component
document.addEventListener('edit-entry', ((e: CustomEvent) => {
    const modal = document.querySelector('entry-modal') as any;
    if (modal) {
        modal.openModal(e.detail.entry);
    }
}) as EventListener);

// Listen for VaultToolbar component events

document.addEventListener('new-entry', (() => {
    const modal = document.querySelector('entry-modal') as any;
    if (modal) {
        modal.openModal();
    }
}) as EventListener);

// Listen for EntryModal component events
document.addEventListener('modal-opened', ((e: CustomEvent) => {
    if (e.detail.entry) {
        vaultState.setEditingId(e.detail.entry.id);
    } else {
        vaultState.setEditingId(null);
    }
}) as EventListener);

document.addEventListener('modal-closed', (() => {
    vaultState.setEditingId(null);
}) as EventListener);

document.addEventListener('entry-saved', ((e: CustomEvent) => {
    const { entry, isEdit } = e.detail;

    if (isEdit) {
        vaultState.updateEntry(entry.id, entry);
    } else {
        vaultState.addEntry(entry);
    }

    vaultState.setEditingId(null);
}) as EventListener);

document.addEventListener('save-vault', (async () => {
    const sessionKey = vaultState.getSessionKey();
    const vault = vaultState.getVault();
    const isDecoy = vaultState.isDecoy();

    if (!sessionKey) return;

    const { ciphertext, iv } = await CryptoEngine.encrypt(JSON.stringify(vault), sessionKey);
    const storageKey = isDecoy ? 'decoy_vault' : 'encrypted_vault';
    localStorage.setItem(storageKey, JSON.stringify({
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(ciphertext))
    }));
    showToast("Vault Encrypted & Saved Successfully.", 'success');
}) as EventListener);

document.addEventListener('lock-vault', (() => {
    if (autoLockService) autoLockService.stop();
    location.reload();
}) as EventListener);

// Listen for autolock setting changes
document.addEventListener('change', ((e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'autolock-setting') {
        const duration = parseInt((target as HTMLSelectElement).value, 10);
        if (autoLockService) {
            autoLockService.setDuration(duration);
            showToast(`Auto-lock timer updated.`, 'success');
        }
    }
}) as EventListener);



/**
 * 8. INITIALIZATION
 */
function initApp() {
    // Create and initialize components
    const vaultTable = document.createElement('vault-table');
    vaultTable.style.display = 'none'; // Hidden component that manages tbody
    document.body.appendChild(vaultTable);

    const vaultSidebar = document.createElement('vault-sidebar');
    vaultSidebar.style.display = 'none'; // Hidden component that manages category list
    document.body.appendChild(vaultSidebar);

    const vaultToolbar = document.createElement('vault-toolbar');
    vaultToolbar.style.display = 'none'; // Hidden component that manages toolbar actions
    document.body.appendChild(vaultToolbar);

    const entryModalComponent = document.createElement('entry-modal');
    entryModalComponent.style.display = 'none'; // Hidden component that manages modal
    document.body.appendChild(entryModalComponent);

    // Setup wizard component
    const setupWizard = document.createElement('setup-wizard');
    setupWizard.style.display = 'none'; // Hidden by default
    document.body.appendChild(setupWizard);

    // Biometric authentication component
    const biometricAuth = document.createElement('biometric-auth');
    biometricAuth.style.display = 'none'; // Hidden component that manages biometric buttons
    document.body.appendChild(biometricAuth);

    // Toast notification manager
    const toastNotification = document.createElement('toast-notification');
    document.body.appendChild(toastNotification);

    // Duress mode is now lazy loaded via index.html <duress-mode> tag or can be instantiated here if strict
    // But since we added it to index.html, it will auto-upgrade

    // Show wizard if vault not initialized
    if (!localStorage.getItem('vault_initialized')) {
        (setupWizard as any).show();
    }

    // Show biometric login if registered
    if (localStorage.getItem('bio_registered') === 'true') {
        document.getElementById('bio-btn')?.classList.remove('hidden');
    }
}

initApp();
