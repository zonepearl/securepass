/**
 * Theme Toggle Component
 * Manages light/dark theme switching with synchronized state
 */

import { BaseComponent } from '../BaseComponent.js';

export class ThemeToggle extends BaseComponent {
    private isGlobal: boolean = false;

    constructor() {
        super();
        // Check if this is a global toggle (used in header)
        this.isGlobal = this.hasAttribute('global');
    }

    protected render(): void {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const buttonText = currentTheme === 'dark' ? '☀️ Light' : '🌙 Dark';

        const buttonClass = this.isGlobal ? 'btn-outline theme-toggle-global' : 'btn-outline';
        const buttonStyle = this.isGlobal ? 'padding: 8px 14px; font-size: 13px;' : '';

        this.innerHTML = `
            <button class="${buttonClass}" title="Toggle Dark/Light Mode" style="${buttonStyle}">
                <span>${buttonText}</span>
            </button>
        `;
    }

    protected attachEventListeners(): void {
        const button = this.querySelector('button');
        button?.addEventListener('click', () => this.toggleTheme());
    }

    private toggleTheme(): void {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Dispatch custom event to notify other theme toggles
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: newTheme } }));
    }

    protected onStateChange(): void {
        // Re-render when theme changes
        this.render();
        this.attachEventListeners();
    }

    connectedCallback(): void {
        super.connectedCallback();

        // Restore persisted theme on first mount (if not already set)
        const saved = localStorage.getItem('theme');
        if (saved && !document.documentElement.hasAttribute('data-theme')) {
            document.documentElement.setAttribute('data-theme', saved);
            this.render();
            this.attachEventListeners();
        }

        // Listen for theme changes from other toggles
        window.addEventListener('theme-changed', () => {
            this.render();
            this.attachEventListeners();
        });
    }
}

// Register the custom element
customElements.define('theme-toggle', ThemeToggle);
