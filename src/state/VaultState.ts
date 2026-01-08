/**
 * Centralized State Management for WebVault
 * Simple reactive state container with event-based updates
 */

type StateListener = () => void;

interface VaultEntry {
    id: string;
    title: string;
    username?: string;
    password: string;
    category: string;
    totpSecret?: string;
    favorite?: boolean;
    history?: string[];
}

interface VaultData {
    entries: VaultEntry[];
}

export class VaultState {
    // Singleton instance
    private static instance: VaultState;

    // State
    private sessionKey: CryptoKey | null = null;
    private vault: VaultData = { entries: [] };
    private isDecoyMode: boolean = false;
    private currentCategory: string = 'all';
    private searchQuery: string = '';
    private editingId: string | null = null;

    // Listeners
    private listeners: Set<StateListener> = new Set();

    private constructor() { }

    static getInstance(): VaultState {
        if (!VaultState.instance) {
            VaultState.instance = new VaultState();
        }
        return VaultState.instance;
    }

    // Subscribe to state changes
    subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Notify all listeners of state change
    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    // Getters
    getSessionKey(): CryptoKey | null {
        return this.sessionKey;
    }

    getVault(): VaultData {
        return this.vault;
    }

    getEntries(): VaultEntry[] {
        return this.vault.entries;
    }

    getFilteredEntries(): VaultEntry[] {
        return this.vault.entries.filter(entry => {
            // Category filter
            if (this.currentCategory !== 'all') {
                if (this.currentCategory === 'favorites' && !entry.favorite) return false;
                if (this.currentCategory !== 'favorites' && entry.category !== this.currentCategory) return false;
            }

            // Search filter
            if (this.searchQuery) {
                const searchableText = `${entry.title} ${entry.username || ''}`.toLowerCase();
                if (!searchableText.includes(this.searchQuery.toLowerCase())) return false;
            }

            return true;
        });
    }

    isDecoy(): boolean {
        return this.isDecoyMode;
    }

    getCurrentCategory(): string {
        return this.currentCategory;
    }

    getSearchQuery(): string {
        return this.searchQuery;
    }

    getEditingId(): string | null {
        return this.editingId;
    }

    // Setters
    setSessionKey(key: CryptoKey | null): void {
        this.sessionKey = key;
        this.notify();
    }

    setVault(vault: VaultData): void {
        this.vault = vault;
        this.notify();
    }

    setDecoyMode(isDecoy: boolean): void {
        this.isDecoyMode = isDecoy;
        this.notify();
    }

    setCurrentCategory(category: string): void {
        this.currentCategory = category;
        this.notify();
    }

    setSearchQuery(query: string): void {
        this.searchQuery = query;
        this.notify();
    }

    setEditingId(id: string | null): void {
        this.editingId = id;
        this.notify();
    }

    // Entry management
    addEntry(entry: VaultEntry): void {
        this.vault.entries.push(entry);
        this.notify();
    }

    updateEntry(id: string, updates: Partial<VaultEntry>): void {
        const index = this.vault.entries.findIndex(e => e.id === id);
        if (index !== -1) {
            const entry = this.vault.entries[index];

            // Track password history if password is changed
            if (updates.password && updates.password !== entry.password) {
                const currentHistory = updates.history || entry.history || [];
                // Add current password to history if it's not already at the top
                if (currentHistory[0] !== entry.password) {
                    updates.history = [entry.password, ...currentHistory].slice(0, 5);
                }
            }

            this.vault.entries[index] = { ...entry, ...updates };
            this.notify();
        }
    }

    deleteEntry(id: string): void {
        this.vault.entries = this.vault.entries.filter(e => e.id !== id);
        this.notify();
    }

    toggleFavorite(id: string): void {
        const entry = this.vault.entries.find(e => e.id === id);
        if (entry) {
            entry.favorite = !entry.favorite;
            this.notify();
        }
    }

    // Category counts
    getCategoryCounts(): Record<string, number> {
        const counts: Record<string, number> = {
            all: this.vault.entries.length,
            favorites: 0,
            work: 0,
            personal: 0,
            finance: 0,
            social: 0,
            other: 0
        };

        this.vault.entries.forEach(entry => {
            const cat = entry.category || 'other';
            if (counts[cat] !== undefined) counts[cat]++;
            if (entry.favorite) counts.favorites++;
        });

        return counts;
    }

    // Reset state (for logout)
    reset(): void {
        this.sessionKey = null;
        this.vault = { entries: [] };
        this.isDecoyMode = false;
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.editingId = null;
        this.notify();
    }
}

// Export singleton instance
export const vaultState = VaultState.getInstance();
