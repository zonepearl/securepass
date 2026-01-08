/**
 * Vault Toolbar Component
 * Manages search, new password, save, and lock actions
 */

import { BaseComponent } from '../BaseComponent.js';
import { vaultState } from '../../state/VaultState.js';
import { BackupService } from '../../utils/backup.js';
import { showToast } from '../shared/ToastNotification.js';

export class VaultToolbar extends BaseComponent {
    protected render(): void {
        // This component doesn't need to render anything
        // It only manages event listeners on existing DOM elements
    }

    protected attachEventListeners(): void {
        // Search input
        const searchInput = document.getElementById('search-input');
        searchInput?.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value;
            vaultState.setSearchQuery(query);

            this.dispatchEvent(new CustomEvent('search-change', {
                detail: { query },
                bubbles: true,
                composed: true
            }));
        });

        // New Password button
        const newEntryBtn = document.getElementById('new-entry-btn');
        newEntryBtn?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('new-entry', {
                bubbles: true,
                composed: true
            }));
        });

        // Save button
        const saveBtn = document.getElementById('save-btn');
        saveBtn?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('save-vault', {
                bubbles: true,
                composed: true
            }));
        });

        // Lock button
        const lockBtn = document.getElementById('lock-btn');
        lockBtn?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('lock-vault', {
                bubbles: true,
                composed: true
            }));
        });

        // Export button
        const exportBtn = document.getElementById('export-btn');
        exportBtn?.addEventListener('click', () => {
            try {
                BackupService.exportBackup();
            } catch (error) {
                showToast((error as Error).message, 'error');
            }
        });

        // Dashboard Toggle button
        const dashboardBtn = document.getElementById('dashboard-toggle-btn');
        dashboardBtn?.addEventListener('click', () => {
            const tableView = document.getElementById('vault-table-view');
            const dashboardView = document.getElementById('security-dashboard-container');

            if (tableView && dashboardView) {
                const isDashboard = !tableView.classList.contains('hidden');
                if (!isDashboard) {
                    tableView.classList.remove('hidden');
                    dashboardView.classList.add('hidden');
                    dashboardBtn.textContent = 'Insights';
                } else {
                    tableView.classList.add('hidden');
                    dashboardView.classList.remove('hidden');
                    dashboardBtn.textContent = 'Back to Vault';
                    // Trigger refresh on dashboard
                    window.dispatchEvent(new CustomEvent('refresh-dashboard'));
                }
            }
        });
    }

    protected onStateChange(): void {
        // Toolbar doesn't need to react to state changes
    }
}

// Register the custom element
customElements.define('vault-toolbar', VaultToolbar);
