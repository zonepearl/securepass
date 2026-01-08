/**
 * Vault Table Component
 * Displays password entries in a table format with actions
 * This component manages the tbody element, not the entire table
 */

import { BaseComponent } from '../BaseComponent.js';
import { vaultState } from '../../state/VaultState.js';
import { SecurityScanner } from '../../security.js';
import { calculateEntropy } from '../../utils/password.js';
import { checkPasswordBreach } from '../../utils/breach-check.js';
import { showToast } from '../shared/ToastNotification.js';
import { WasmCryptoService } from '../../services/WasmCryptoService.js';

export class VaultTable extends BaseComponent {
    protected render(): void {
        const filteredEntries = vaultState.getFilteredEntries();

        // Find the tbody element in the DOM
        const tbody = document.getElementById('vault-table-body');
        if (!tbody) return;

        // Handle empty state
        const emptyState = document.getElementById('empty-state');
        if (filteredEntries.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            tbody.innerHTML = '';
            return;
        } else {
            if (emptyState) emptyState.classList.add('hidden');
        }

        // Build table rows HTML
        let rowsHTML = '';
        for (const entry of filteredEntries) {
            const entropy = calculateEntropy(entry.password);

            rowsHTML += `
                <tr data-entry-id="${entry.id}">
                    <td>
                        <span class="fav-btn ${entry.favorite ? 'active' : ''}" title="Toggle Favorite">
                            ${entry.favorite ? '★' : '☆'}
                        </span>
                    </td>
                    <td>
                        <span class="table-icon">${entry.title.charAt(0).toUpperCase()}</span>
                    </td>
                    <td>
                        <strong>${SecurityScanner.escapeHTML(entry.title)}</strong>
                    </td>
                    <td>
                        <span class="category-display">${this.getCategoryName(entry.category || 'other')}</span>
                    </td>
                    <td>
                        <span class="username-display">${SecurityScanner.escapeHTML(entry.username || '—')}</span>
                    </td>
                    <td>
                        ${entry.totpSecret ? '<span class="totp-indicator" style="cursor: pointer; color: var(--text);">View</span>' : '<span style="opacity: 0.3;">—</span>'}
                    </td>
                    <td>
                        <span class="audit-badge ${entropy < 60 ? 'badge-danger' : 'badge-success'}">
                            ${entropy < 60 ? 'Weak' : 'Strong'}
                        </span>
                    </td>
                    <td class="breach-cell">
                        <span class="breach-status-checking">Checking...</span>
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="icon-btn copy-pwd-btn" title="Copy Password">Copy</button>
                            <button class="icon-btn edit-btn" title="Edit">Edit</button>
                            <button class="icon-btn del-btn" title="Delete">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }

        // Update table body
        tbody.innerHTML = rowsHTML;

        // Attach event listeners and run breach checks
        this.attachRowEventListeners();
        this.runBreachChecks();
    }

    protected attachEventListeners(): void {
        // Event listeners are attached per-row in attachRowEventListeners
    }

    private attachRowEventListeners(): void {
        const tbody = document.getElementById('vault-table-body');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr[data-entry-id]');
        const entries = vaultState.getFilteredEntries();

        rows.forEach((row, index) => {
            const entry = entries[index];
            if (!entry) return;

            // Copy password button
            const copyBtn = row.querySelector('.copy-pwd-btn');
            copyBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(entry.password);
                const btn = e.target as HTMLElement;
                const oldText = btn.textContent;
                btn.textContent = '✅';
                setTimeout(() => btn.textContent = oldText, 1500);
            });

            // Edit button
            const editBtn = row.querySelector('.edit-btn');
            editBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('edit-entry', {
                    detail: { entry },
                    bubbles: true,
                    composed: true
                }));
            });

            // Delete button
            const delBtn = row.querySelector('.del-btn');
            delBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${entry.title}"?`)) {
                    vaultState.deleteEntry(entry.id);
                }
            });

            // TOTP indicator
            const totpIndicator = row.querySelector('.totp-indicator');
            totpIndicator?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showTOTPModal(entry);
            });

            // Row click to show details
            row.addEventListener('click', () => {
                this.showEntryDetails(entry);
            });

            // Favorite toggle
            const favBtn = row.querySelector('.fav-btn');
            favBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                vaultState.toggleFavorite(entry.id);
            });
        });
    }

    private async runBreachChecks(): Promise<void> {
        const tbody = document.getElementById('vault-table-body');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr[data-entry-id]');
        const entries = vaultState.getFilteredEntries();

        rows.forEach(async (row, index) => {
            const entry = entries[index];
            if (!entry) return;

            const breachCell = row.querySelector('.breach-cell');
            if (!breachCell) return;

            try {
                const count = await checkPasswordBreach(entry.password);
                if (count > 0) {
                    breachCell.innerHTML = `<span class="audit-badge badge-danger" title="Found in ${count.toLocaleString()} breaches">${count > 1000 ? '1K+' : count} Breaches</span>`;
                } else {
                    breachCell.innerHTML = `<span class="audit-badge badge-success">Safe</span>`;
                }
            } catch {
                breachCell.innerHTML = `<span style="opacity: 0.3; font-size: 11px;">—</span>`;
            }
        });
    }

    private getCategoryName(category: string): string {
        const names: Record<string, string> = {
            work: 'Work',
            personal: 'Personal',
            finance: 'Finance',
            social: 'Social',
            other: 'Other'
        };
        return names[category] || 'Other';
    }

    private showEntryDetails(entry: any): void {
        // Instead of a primitive alert, open the edit modal which shows all details
        this.dispatchEvent(new CustomEvent('edit-entry', {
            detail: { entry },
            bubbles: true,
            composed: true
        }));
    }

    private showTOTPModal(entry: any): void {
        if (!entry.totpSecret) return;

        const bridge = vaultState.getCryptoBridge();
        if (!bridge) {
            showToast("Vault connection Error.", 'error');
            return;
        }

        try {
            const code = WasmCryptoService.getTotpCode(bridge, entry.totpSecret);
            const formattedCode = code.match(/.{1,3}/g)?.join(' ') || code;
            navigator.clipboard.writeText(code);
            showToast(`Code Copied: ${formattedCode}`, 'success');
        } catch (e) {
            showToast("Invalid TOTP Secret", 'error');
        }
    }
}

// Register the custom element
customElements.define('vault-table', VaultTable);
