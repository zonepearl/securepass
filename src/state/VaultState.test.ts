import { describe, it, expect, beforeEach } from 'vitest';
import { VaultState } from './VaultState.js';

describe('VaultState', () => {
    let state: VaultState;

    beforeEach(() => {
        state = VaultState.getInstance();
        state.reset();
    });

    describe('Entry Management', () => {
        it('should add an entry correctly', () => {
            const entry = {
                id: '1',
                title: 'Test Service',
                password: 'password123',
                category: 'personal'
            };
            state.addEntry(entry);
            expect(state.getEntries()).toHaveLength(1);
            expect(state.getEntries()[0]).toEqual(entry);
        });

        it('should delete an entry correctly', () => {
            state.addEntry({ id: '1', title: 'T1', password: 'p1', category: 'personal' });
            state.deleteEntry('1');
            expect(state.getEntries()).toHaveLength(0);
        });

        it('should update an entry correctly', () => {
            state.addEntry({ id: '1', title: 'Old Title', password: 'p1', category: 'personal' });
            state.updateEntry('1', { title: 'New Title' });
            expect(state.getEntries()[0].title).toBe('New Title');
        });
    });

    describe('Password History Tracking', () => {
        it('should track password history when password changes', () => {
            state.addEntry({ id: '1', title: 'T1', password: 'p1', category: 'personal' });

            state.updateEntry('1', { password: 'p2' });
            expect(state.getEntries()[0].history).toEqual(['p1']);

            state.updateEntry('1', { password: 'p3' });
            expect(state.getEntries()[0].history).toEqual(['p2', 'p1']);
        });

        it('should not track history if password remains the same', () => {
            state.addEntry({ id: '1', title: 'T1', password: 'p1', category: 'personal' });
            state.updateEntry('1', { password: 'p1' });
            expect(state.getEntries()[0].history).toBeUndefined();
        });

        it('should limit history to 5 most recent passwords', () => {
            state.addEntry({ id: '1', title: 'T1', password: 'initial', category: 'personal' });

            state.updateEntry('1', { password: 'p1' });
            state.updateEntry('1', { password: 'p2' });
            state.updateEntry('1', { password: 'p3' });
            state.updateEntry('1', { password: 'p4' });
            state.updateEntry('1', { password: 'p5' });
            state.updateEntry('1', { password: 'p6' });

            const entry = state.getEntries()[0];
            expect(entry.history).toHaveLength(5);
            expect(entry.history![0]).toBe('p5');
            expect(entry.history![4]).toBe('p1');
        });

        it('should merge history from updates correctly (regression fix check)', () => {
            state.addEntry({
                id: '1',
                title: 'T1',
                password: 'p1',
                category: 'personal',
                history: ['h1']
            });

            // Simulate UI sending back the existing history during an update
            state.updateEntry('1', {
                password: 'p2',
                history: ['h1']
            });

            const entry = state.getEntries()[0];
            expect(entry.history).toEqual(['p1', 'h1']);
        });
    });

    describe('Filtering', () => {
        beforeEach(() => {
            state.addEntry({ id: '1', title: 'Github', password: 'p1', category: 'work', favorite: true });
            state.addEntry({ id: '2', title: 'Gmail', password: 'p2', category: 'personal' });
            state.addEntry({ id: '3', title: 'Bank', password: 'p3', category: 'finance' });
        });

        it('should filter by category', () => {
            state.setCurrentCategory('work');
            expect(state.getFilteredEntries()).toHaveLength(1);
            expect(state.getFilteredEntries()[0].title).toBe('Github');
        });

        it('should filter by favorites', () => {
            state.setCurrentCategory('favorites');
            expect(state.getFilteredEntries()).toHaveLength(1);
            expect(state.getFilteredEntries()[0].title).toBe('Github');
        });

        it('should filter by search query', () => {
            state.setSearchQuery('gm');
            expect(state.getFilteredEntries()).toHaveLength(1);
            expect(state.getFilteredEntries()[0].title).toBe('Gmail');
        });
    });

    describe('Favorites', () => {
        it('should toggle favorite status', () => {
            state.addEntry({ id: '1', title: 'T1', password: 'p1', category: 'personal', favorite: false });
            state.toggleFavorite('1');
            expect(state.getEntries()[0].favorite).toBe(true);
            state.toggleFavorite('1');
            expect(state.getEntries()[0].favorite).toBe(false);
        });
    });
});
