/**
 * Vault Sidebar Component
 * Manages category navigation and counts
 */

import { BaseComponent } from '../BaseComponent.js';
import { vaultState } from '../../state/VaultState.js';

interface Category {
    id: string;
    icon: string;
    name: string;
}

export class VaultSidebar extends BaseComponent {
    private categories: Category[] = [
        { id: 'all', icon: '📦', name: 'All Items' },
        { id: 'favorites', icon: '⭐', name: 'Favorites' },
        { id: 'work', icon: '💼', name: 'Work' },
        { id: 'personal', icon: '👤', name: 'Personal' },
        { id: 'finance', icon: '💳', name: 'Finance' },
        { id: 'social', icon: '🌐', name: 'Social' },
        { id: 'other', icon: '📁', name: 'Other' }
    ];

    protected render(): void {
        const counts = vaultState.getCategoryCounts();
        const currentCategory = vaultState.getCurrentCategory();

        // Find category list container
        const categoryList = document.getElementById('category-list');
        if (!categoryList) return;

        // Build category items HTML
        let categoriesHTML = '';
        for (const category of this.categories) {
            const isActive = currentCategory === category.id;
            const count = counts[category.id] || 0;

            categoriesHTML += `
                <div class="category-item ${isActive ? 'active' : ''}" data-category="${category.id}">
                    <span class="category-icon">${category.icon}</span>
                    <span class="category-name">${category.name}</span>
                    <span class="category-count" id="count-${category.id}">${count}</span>
                </div>
            `;
        }

        categoryList.innerHTML = categoriesHTML;

        // Attach event listeners
        this.attachCategoryListeners();
    }

    protected attachEventListeners(): void {
        // Event listeners attached in attachCategoryListeners
    }

    private attachCategoryListeners(): void {
        const categoryList = document.getElementById('category-list');
        if (!categoryList) return;

        const items = categoryList.querySelectorAll('.category-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const category = target.getAttribute('data-category') || 'all';

                // Update active state in DOM
                items.forEach(i => i.classList.remove('active'));
                target.classList.add('active');

                // Update state
                vaultState.setCurrentCategory(category);

                // Dispatch event for main.ts compatibility
                this.dispatchEvent(new CustomEvent('category-change', {
                    detail: { category },
                    bubbles: true,
                    composed: true
                }));
            });
        });
    }
}

// Register the custom element
customElements.define('vault-sidebar', VaultSidebar);
