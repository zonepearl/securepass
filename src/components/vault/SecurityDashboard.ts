/**
 * Security Dashboard Component
 * Visualizes vault health and security insights
 */

import { BaseComponent } from '../BaseComponent.js';
import { vaultState } from '../../state/VaultState.js';
import { calculateEntropy } from '../../utils/password.js';
import { checkPasswordBreach } from '../../utils/breach-check.js';
import { SecurityScanner } from '../../security.js';

export class SecurityDashboard extends BaseComponent {
    private breachCounts: Record<string, number> = {};
    private isScanning: boolean = false;

    constructor() {
        super();
        window.addEventListener('refresh-dashboard', () => this.runSecurityScan());
    }

    protected render(): void {
        const entries = vaultState.getEntries();
        const container = document.getElementById('security-dashboard-container');
        if (!container) return;

        if (entries.length === 0) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                    <h3>No entries to analyze</h3>
                    <p>Add some passwords to see your security insights.</p>
                </div>
            `;
            return;
        }

        const stats = this.calculateStats(entries);
        const healthScore = this.calculateHealthScore(stats);

        container.innerHTML = `
            <div class="dashboard-wrapper" style="padding: 32px; max-width: 900px; margin: 0 auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
                    <div>
                        <h2 style="margin: 0; font-size: 24px;">Security Dashboard</h2>
                        <p style="margin: 4px 0 0; color: var(--text-secondary);">Real-time vault health analysis</p>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button id="rescan-btn" class="btn-outline" ${this.isScanning ? 'disabled' : ''}>
                            ${this.isScanning ? 'Scanning...' : 'Run Depth Scan'}
                        </button>
                        <button id="dashboard-back-btn" class="btn-primary">
                            Back to Vault
                        </button>
                    </div>
                </div>

                <!-- Score Card -->
                <div class="glass-card" style="padding: 32px; margin-bottom: 24px; text-align: center; background: linear-gradient(135deg, rgba(2, 132, 199, 0.1), rgba(59, 130, 246, 0.05)); border: 1px solid var(--primary); border-radius: 24px;">
                    <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); font-weight: 700; margin-bottom: 8px;">Overall Health Score</div>
                    <div style="font-size: 72px; font-weight: 800; color: var(--text); line-height: 1;">${healthScore}%</div>
                    <div style="margin-top: 16px; font-size: 16px; color: ${this.getScoreColor(healthScore)}">${this.getScoreLabel(healthScore)}</div>
                </div>

                <!-- Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                    <div class="glass-card" style="padding: 20px;">
                        <div style="font-size: 12px; opacity: 0.6; margin-bottom: 4px;">WEAK PASSWORDS</div>
                        <div style="font-size: 24px; font-weight: 700; color: ${stats.weakCount > 0 ? 'var(--danger)' : 'var(--success)'}">${stats.weakCount}</div>
                    </div>
                    <div class="glass-card" style="padding: 20px;">
                        <div style="font-size: 12px; opacity: 0.6; margin-bottom: 4px;">REUSED PASSWORDS</div>
                        <div style="font-size: 24px; font-weight: 700; color: ${stats.reuseCount > 0 ? 'var(--warning)' : 'var(--success)'}">${stats.reuseCount}</div>
                    </div>
                    <div class="glass-card" style="padding: 20px;">
                        <div style="font-size: 12px; opacity: 0.6; margin-bottom: 4px;">BREACHED PASSWORDS</div>
                        <div style="font-size: 24px; font-weight: 700; color: ${stats.breachCount > 0 ? 'var(--danger)' : 'var(--success)'}">${stats.breachCount}</div>
                    </div>
                    <div class="glass-card" style="padding: 20px;">
                        <div style="font-size: 12px; opacity: 0.6; margin-bottom: 4px;">MFA COVERAGE</div>
                        <div style="font-size: 24px; font-weight: 700; color: var(--primary)">${stats.mfaPercentage}%</div>
                    </div>
                </div>

                <!-- Detailed sections -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                    <div class="glass-card" style="padding: 24px;">
                        <h3 style="margin-top: 0; font-size: 16px;">Improvement Tips</h3>
                        <ul style="padding-left: 20px; font-size: 14px; line-height: 1.6; color: var(--text-secondary);">
                            ${this.generateTips(stats)}
                        </ul>
                    </div>
                    <div class="glass-card" style="padding: 24px;">
                        <h3 style="margin-top: 0; font-size: 16px;">Vulnerable Entries</h3>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${this.renderVulnerableList(entries)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#rescan-btn')?.addEventListener('click', () => this.runSecurityScan());
        container.querySelector('#dashboard-back-btn')?.addEventListener('click', () => {
            document.getElementById('dashboard-toggle-btn')?.click();
        });
    }

    private calculateStats(entries: any[]) {
        let weakCount = 0;
        let reuseCount = 0;
        let breachCount = 0;
        let mfaCount = 0;

        const pwdMap: Record<string, number> = {};

        entries.forEach(e => {
            // Weak check
            const entropy = calculateEntropy(e.password);
            if (entropy < 60) weakCount++;

            // Reuse check
            pwdMap[e.password] = (pwdMap[e.password] || 0) + 1;

            // MFA check
            if (e.totpSecret) mfaCount++;

            // Breach check (cached from background scans or previous stats)
            if (this.breachCounts[e.id] > 0) breachCount++;
        });

        // Sum up reuses
        Object.values(pwdMap).forEach(count => {
            if (count > 1) reuseCount += count;
        });

        return {
            weakCount,
            reuseCount,
            breachCount,
            mfaPercentage: Math.round((mfaCount / entries.length) * 100),
            total: entries.length
        };
    }

    private calculateHealthScore(stats: any): number {
        const weakPenalty = (stats.weakCount / stats.total) * 40;
        const reusePenalty = (stats.reuseCount / stats.total) * 30;
        const breachPenalty = (stats.breachCount / stats.total) * 30;

        let score = 100 - (weakPenalty + reusePenalty + breachPenalty);
        return Math.max(0, Math.round(score));
    }

    private getScoreColor(score: number): string {
        if (score > 80) return 'var(--success)';
        if (score > 50) return 'var(--warning)';
        return 'var(--danger)';
    }

    private getScoreLabel(score: number): string {
        if (score > 90) return 'Exceptional Security';
        if (score > 75) return 'Good Protection';
        if (score > 50) return 'Moderate Risk';
        return 'Critical Vulnerabilities Detected';
    }

    private generateTips(stats: any): string {
        let tips = [];
        if (stats.weakCount > 0) tips.push(`Replace <strong>${stats.weakCount}</strong> weak passwords with Wasm-generated secure ones.`);
        if (stats.reuseCount > 0) tips.push(`You have <strong>${stats.reuseCount}</strong> shared passwords. Ensure every service has a unique key.`);
        if (stats.mfaPercentage < 100) tips.push('Enable TOTP for more accounts to add a second layer of defense.');
        if (stats.breachCount > 0) tips.push(`<span style="color: var(--danger)">CRITICAL: <strong>${stats.breachCount}</strong> passwords found in public breaches. Change them immediately!</span>`);

        if (tips.length === 0) return '<li>All security checks passed! Your vault is in perfect shape.</li>';
        return tips.map(t => `<li style="margin-bottom: 8px;">${t}</li>`).join('');
    }

    private renderVulnerableList(entries: any[]): string {
        const vulnerable = entries.filter(e => {
            return calculateEntropy(e.password) < 60 || this.breachCounts[e.id] > 0;
        });

        if (vulnerable.length === 0) return '<p style="font-size: 13px; opacity: 0.6;">No vulnerable entries found.</p>';

        return vulnerable.map(e => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                <span style="font-size: 13px; font-weight: 500;">${SecurityScanner.escapeHTML(e.title)}</span>
                <span style="font-size: 11px; color: var(--danger);">${this.breachCounts[e.id] > 0 ? 'Breached' : 'Weak'}</span>
            </div>
        `).join('');
    }

    private async runSecurityScan(): Promise<void> {
        if (this.isScanning) return;
        this.isScanning = true;
        this.render();

        const entries = vaultState.getEntries();
        for (const entry of entries) {
            try {
                const count = await checkPasswordBreach(entry.password);
                this.breachCounts[entry.id] = count;
            } catch (e) {
                console.error("Breach scan failed for", entry.title);
            }
        }

        this.isScanning = false;
        this.render();
    }
}

// Register component
customElements.define('security-dashboard', SecurityDashboard);
