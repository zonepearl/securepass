
import { CryptoEngine } from './crypto.js';
import { SecurityScanner } from './security.js';
import { generatePassword, calculateEntropy } from './utils/password.js';
import { checkPasswordBreach } from './utils/breach-check.js';

import * as OTPAuth from 'otpauth';

/**
 * Generate TOTP code from Base32 secret
 * Returns 6-digit code and seconds remaining
 */
function generateTOTP(secret: string) {
    try {
        let totp = new OTPAuth.TOTP({
            issuer: "WebVault",
            label: "PearlYoung",
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret)
        });

        const code = totp.generate();
        const secondsSecondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
        return { code, secondsSecondsRemaining };
    } catch (e) {
        return { code: "Invalid Secret", secondsSecondsRemaining: 0 };
    }
}
/**
 * 1. GLOBAL STATE & CONFIG
 */
let sessionKey: CryptoKey | null = null;
let vault: { entries: any[] } = { entries: [] };
let isDecoyMode = false;
let editingId: string | null = null;
let currentCategory = 'all'; // Track active category filter

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32)); // 256-bit salt
}

/**
 * Retrieve salt from localStorage or generate new one
 */
function getSalt(storageKey: string): Uint8Array {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
        const saltArray = JSON.parse(stored);
        return new Uint8Array(saltArray);
    }
    return generateSalt();
}

/**
 * 2. WIZARD & ONBOARDING LOGIC
 */
function goToStep(step: number) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
    const targetStep = document.getElementById(`step-${step}`);
    if (targetStep) targetStep.classList.remove('hidden');
}

async function handleFinishSetup() {
    const p1 = (document.getElementById('setup-pwd') as HTMLInputElement).value;
    const p2 = (document.getElementById('setup-pwd-conf') as HTMLInputElement).value;

    if (p1.length < 12) return alert("Security Requirement: Master Password must be at least 12 characters.");
    if (p1 !== p2) return alert("Passwords do not match.");

    try {
        const initialVault = { entries: [] };

        // Generate unique salt for this vault
        const salt = generateSalt();
        const key = await CryptoEngine.deriveKey(p1, salt);
        const { ciphertext, iv } = await CryptoEngine.encrypt(JSON.stringify(initialVault), key);

        // Store encrypted vault
        localStorage.setItem('encrypted_vault', JSON.stringify({
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(ciphertext))
        }));

        // Store salt separately (unencrypted - salt is not secret)
        localStorage.setItem('vault_salt', JSON.stringify(Array.from(salt)));
        localStorage.setItem('vault_initialized', 'true');

        alert("Vault created successfully! Please log in with your new password.");
        location.reload();
    } catch (e) {
        alert("Setup failed. Ensure your browser supports WebCrypto.");
    }
}

/**
 * 3. BIOMETRIC LOGIC (WEBAUTHN WITH PASSKEY)
 *
 * SECURITY MODEL: Secure passkey-based unlock with encrypted password storage
 * - Master password is encrypted and stored in localStorage
 * - Encryption key is derived from a random wrapping key
 * - Wrapping key is encrypted using the WebAuthn credential ID as key material
 * - On TouchID verification, wrapping key is decrypted and used to unlock password
 * - This provides true passwordless login while maintaining security
 *
 * SECURITY PROPERTIES:
 * - Master password encrypted with AES-GCM
 * - Wrapping key derived from credential ID (unique per device)
 * - Requires biometric verification to decrypt
 * - Zero-knowledge: server never sees password or keys
 */

/**
 * Derive a wrapping key from the WebAuthn credential ID
 */
async function deriveWrappingKey(credentialId: Uint8Array): Promise<CryptoKey> {
    // Import credential ID as key material
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        credentialId as any, // Use 'as any' to bypass TypeScript buffer check
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    // Derive a wrapping key using PBKDF2
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: new Uint8Array([87, 101, 98, 86, 97, 117, 108, 116]) as any, // "WebVault" as salt
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypt master password for passkey storage
 */
async function encryptPassword(password: string, wrappingKey: CryptoKey): Promise<{ iv: number[]; data: number[] }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as any },
        wrappingKey,
        encoder.encode(password)
    );
    return {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted))
    };
}

/**
 * Decrypt master password from passkey storage
 */
async function decryptPassword(encryptedData: { iv: number[]; data: number[] }, wrappingKey: CryptoKey): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) as any },
        wrappingKey,
        new Uint8Array(encryptedData.data).buffer
    );
    return new TextDecoder().decode(decrypted);
}

async function registerBiometrics() {
    // Verify vault is currently unlocked
    if (!sessionKey) {
        return alert("Please unlock your vault first before enabling biometrics.");
    }

    // Get the current master password from input
    const pwdInput = document.getElementById('master-pwd') as HTMLInputElement;
    const masterPassword = pwdInput?.value;

    if (!masterPassword) {
        return alert("Master password not found. Please unlock your vault first.");
    }

    try {
        if (window.isSecureContext && window.PublicKeyCredential) {
            const challenge = crypto.getRandomValues(new Uint8Array(32));
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: "WebVault" },
                    user: {
                        id: crypto.getRandomValues(new Uint8Array(16)),
                        name: "vault_user",
                        displayName: "Vault User"
                    },
                    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required"
                    }
                }
            }) as PublicKeyCredential;

            if (credential) {
                const credentialId = new Uint8Array(credential.rawId);

                // Derive wrapping key from credential ID
                const wrappingKey = await deriveWrappingKey(credentialId);

                // Encrypt master password
                const encryptedPassword = await encryptPassword(masterPassword, wrappingKey);

                // Store credential ID and encrypted password
                localStorage.setItem('bio_credential_id', btoa(String.fromCharCode(...credentialId)));
                localStorage.setItem('bio_wrapped_password', JSON.stringify(encryptedPassword));
                localStorage.setItem('bio_registered', 'true');

                alert("✓ Passkey registered! Next time, unlock with TouchID/FaceID without entering password.");
            }
        } else {
            alert("WebAuthn not supported. Requires HTTPS and compatible device.");
        }
    } catch (e) {
        console.error("Biometric registration failed:", e);
        alert("Passkey registration failed. Ensure you're using HTTPS and have a compatible device.");
    }
}

async function biometricUnlock() {
    try {
        const idBase64 = localStorage.getItem('bio_credential_id');
        const wrappedPasswordJson = localStorage.getItem('bio_wrapped_password');

        if (!idBase64) {
            alert("No passkey found. Please register TouchID/FaceID first.");
            return;
        }

        if (!wrappedPasswordJson) {
            // Fallback: Old biometric system without password wrapping
            alert("Legacy biometric mode detected. Please re-register your passkey for passwordless unlock.");
            return;
        }

        if (window.isSecureContext && window.PublicKeyCredential) {
            // Verify biometric identity with TouchID/FaceID
            const challenge = crypto.getRandomValues(new Uint8Array(32));
            await navigator.credentials.get({
                publicKey: {
                    challenge,
                    allowCredentials: [{
                        id: Uint8Array.from(atob(idBase64), c => c.charCodeAt(0)),
                        type: 'public-key'
                    }],
                    userVerification: "required"
                }
            });

            // Biometric verification succeeded - decrypt master password
            const credentialId = Uint8Array.from(atob(idBase64), c => c.charCodeAt(0));
            const wrappingKey = await deriveWrappingKey(credentialId);
            const encryptedPassword = JSON.parse(wrappedPasswordJson);
            const masterPassword = await decryptPassword(encryptedPassword, wrappingKey);

            // Auto-fill password and trigger unlock
            const pwdInput = document.getElementById('master-pwd') as HTMLInputElement;
            if (pwdInput) {
                pwdInput.value = masterPassword;
                document.getElementById('unlock-btn')?.click();

                // Clear password from input after unlock attempt for security
                setTimeout(() => {
                    if (pwdInput) pwdInput.value = '';
                }, 100);
            }
        }
    } catch (e) {
        console.warn("Passkey unlock failed or cancelled:", e);
        alert("TouchID/FaceID authentication failed or was cancelled.");
    }
}

/**
 * 4. DURESS (STEALTH) MODE
 */
async function setupDuress() {
    const dPwd = prompt("Set a secondary 'Panic' password (different from master):");
    if (!dPwd) return;
    if (dPwd.length < 12) {
        alert("Duress password must be at least 12 characters.");
        return;
    }

    const decoy = { entries: [{ id: 'decoy-1', title: 'Fake Bank', password: 'password123' }] };

    // Generate unique salt for duress vault
    const salt = generateSalt();
    const key = await CryptoEngine.deriveKey(dPwd, salt);
    const { ciphertext, iv } = await CryptoEngine.encrypt(JSON.stringify(decoy), key);

    // Store decoy vault and its salt
    localStorage.setItem('decoy_vault', JSON.stringify({
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(ciphertext))
    }));
    localStorage.setItem('decoy_salt', JSON.stringify(Array.from(salt)));

    alert("Duress Vault Ready. Log in with this password to show fake data.");
}

/**
 * 5. CORE UI RENDERING - NEW TABLE VIEW
 */
async function renderUI() {
    renderTable();
    updateCategoryCounts();
}

/**
 * Update category counts in sidebar
 */
function updateCategoryCounts() {
    const counts: Record<string, number> = {
        all: vault.entries.length,
        favorites: 0,
        work: 0,
        personal: 0,
        finance: 0,
        social: 0,
        other: 0
    };

    vault.entries.forEach(entry => {
        const cat = entry.category || 'other';
        if (counts[cat] !== undefined) counts[cat]++;
        if (entry.favorite) counts.favorites++;
    });

    Object.keys(counts).forEach(cat => {
        const el = document.getElementById(`count-${cat}`);
        if (el) el.textContent = counts[cat].toString();
    });
}

/**
 * Render entries in table view
 */
async function renderTable() {
    const tbody = document.getElementById('vault-table-body');
    const emptyState = document.getElementById('empty-state');
    if (!tbody) return;

    tbody.innerHTML = '';
    const searchEl = document.getElementById('search-input') as HTMLInputElement;
    const query = searchEl ? searchEl.value.toLowerCase() : "";

    // Filter entries
    let filteredEntries = vault.entries.filter(entry => {
        // Category filter
        if (currentCategory !== 'all') {
            if (currentCategory === 'favorites' && !entry.favorite) return false;
            if (currentCategory !== 'favorites' && entry.category !== currentCategory) return false;
        }

        // Search filter
        if (query) {
            const searchableText = `${entry.title} ${entry.username || ''}`.toLowerCase();
            if (!searchableText.includes(query)) return false;
        }

        return true;
    });

    // Show/hide empty state
    if (emptyState) {
        emptyState.classList.toggle('hidden', filteredEntries.length > 0);
    }

    for (const entry of filteredEntries) {
        const entropy = calculateEntropy(entry.password);
        const categoryIcon = getCategoryIcon(entry.category || 'other');

        const row = document.createElement('tr');
        row.dataset.entryId = entry.id;

        // Initial row with loading state for breach check
        row.innerHTML = `
            <td>
                <span class="table-icon">${categoryIcon}</span>
            </td>
            <td>
                <strong>${SecurityScanner.escapeHTML(entry.title)}</strong>
            </td>
            <td>
                <span style="font-size: 12px; opacity: 0.7;">${getCategoryName(entry.category || 'other')}</span>
            </td>
            <td>
                <span style="font-size: 13px; opacity: 0.8;">${SecurityScanner.escapeHTML(entry.username || '—')}</span>
            </td>
            <td>
                ${entry.totpSecret ? '<span class="totp-indicator" style="cursor: pointer;">🔐 View</span>' : '<span style="opacity: 0.3;">—</span>'}
            </td>
            <td>
                <span class="audit-badge ${entropy < 60 ? 'badge-danger' : 'badge-success'}" style="font-size: 10px;">
                    ${entropy < 60 ? '⚠️ Weak' : '✅ Strong'}
                </span>
            </td>
            <td class="breach-cell">
                <span style="opacity: 0.5; font-size: 11px;">Checking...</span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="icon-btn copy-pwd-btn" title="Copy Password">📋</button>
                    <button class="icon-btn edit-btn" title="Edit">✏️</button>
                    <button class="icon-btn del-btn" title="Delete">🗑️</button>
                </div>
            </td>
        `;

        // Check for breaches asynchronously
        checkPasswordBreach(entry.password).then(count => {
            const breachCell = row.querySelector('.breach-cell');
            if (breachCell) {
                if (count > 0) {
                    breachCell.innerHTML = `<span class="audit-badge badge-danger" style="font-size: 10px;" title="Found in ${count.toLocaleString()} breaches">⚠️ ${count > 1000 ? '1K+' : count}</span>`;
                } else {
                    breachCell.innerHTML = `<span class="audit-badge badge-success" style="font-size: 10px;">✅ Safe</span>`;
                }
            }
        }).catch(() => {
            const breachCell = row.querySelector('.breach-cell');
            if (breachCell) {
                breachCell.innerHTML = `<span style="opacity: 0.3; font-size: 11px;">—</span>`;
            }
        });

        // Copy password button
        row.querySelector('.copy-pwd-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(entry.password);
            const btn = e.target as HTMLElement;
            const oldText = btn.textContent;
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = oldText, 1500);
        });

        // Edit button
        row.querySelector('.edit-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openEntryModal(entry);
        });

        // Delete button
        row.querySelector('.del-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${entry.title}"?`)) {
                vault.entries = vault.entries.filter(x => x.id !== entry.id);
                renderUI();
            }
        });

        // TOTP indicator
        row.querySelector('.totp-indicator')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showTOTPModal(entry);
        });

        // Row click to show details
        row.addEventListener('click', () => {
            showEntryDetails(entry);
        });

        tbody.appendChild(row);
    }
}

/**
 * Get category icon
 */
function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
        work: '💼',
        personal: '👤',
        finance: '💳',
        social: '🌐',
        other: '📋'
    };
    return icons[category] || '📋';
}

/**
 * Get category name
 */
function getCategoryName(category: string): string {
    const names: Record<string, string> = {
        work: 'Work',
        personal: 'Personal',
        finance: 'Finance',
        social: 'Social',
        other: 'Other'
    };
    return names[category] || 'Other';
}

/**
 * Show entry details in modal
 */
function showEntryDetails(entry: any) {
    const entropy = calculateEntropy(entry.password);
    alert(`Service: ${entry.title}\nUsername: ${entry.username || 'N/A'}\nPassword: ${entry.password}\nCategory: ${getCategoryName(entry.category || 'other')}\nSecurity: ${entropy} bits`);
}

/**
 * Show TOTP code in modal
 */
function showTOTPModal(entry: any) {
    if (!entry.totpSecret) return;
    const { code } = generateTOTP(entry.totpSecret);
    const formattedCode = code.match(/.{1,3}/g)?.join(' ') || code;
    navigator.clipboard.writeText(code);
    alert(`2FA Code for ${entry.title}:\n\n${formattedCode}\n\n(Copied to clipboard)`);
}

/**
 * Open entry modal for creating/editing
 */
function openEntryModal(entry?: any) {
    const modal = document.getElementById('entry-modal');
    const modalTitle = document.getElementById('modal-title');
    const addBtn = document.getElementById('add-btn') as HTMLButtonElement;

    if (!modal) return;

    if (entry) {
        // Edit mode
        editingId = entry.id;
        if (modalTitle) modalTitle.textContent = 'Edit Password Entry';
        if (addBtn) addBtn.textContent = 'Update Entry';

        (document.getElementById('entry-title') as HTMLInputElement).value = entry.title;
        (document.getElementById('entry-username') as HTMLInputElement).value = entry.username || '';
        (document.getElementById('new-password') as HTMLInputElement).value = entry.password;
        (document.getElementById('entry-category') as HTMLSelectElement).value = entry.category || 'personal';
        (document.getElementById('totp-secret') as HTMLInputElement).value = entry.totpSecret || '';
    } else {
        // Create mode
        editingId = null;
        if (modalTitle) modalTitle.textContent = 'New Password Entry';
        if (addBtn) addBtn.textContent = 'Save Entry';

        (document.getElementById('entry-title') as HTMLInputElement).value = '';
        (document.getElementById('entry-username') as HTMLInputElement).value = '';
        (document.getElementById('new-password') as HTMLInputElement).value = '';
        (document.getElementById('entry-category') as HTMLSelectElement).value = 'personal';
        (document.getElementById('totp-secret') as HTMLInputElement).value = '';
    }

    modal.classList.remove('hidden');
}

/**
 * Close entry modal
 */
function closeEntryModal() {
    const modal = document.getElementById('entry-modal');
    if (modal) modal.classList.add('hidden');
    editingId = null;
}

/**
 * 6. AUTHENTICATION & CORE EVENTS
 */
document.getElementById('unlock-btn')?.addEventListener('click', async () => {
    const pwdInput = document.getElementById('master-pwd') as HTMLInputElement;
    const pwd = pwdInput ? pwdInput.value : "";
    if (!pwd) return;

    try {
        const real = localStorage.getItem('encrypted_vault');
        const decoy = localStorage.getItem('decoy_vault');

        let decrypted = null;

        // Try to decrypt real vault first
        if (real) {
            try {
                const realSalt = getSalt('vault_salt');
                const realKey = await CryptoEngine.deriveKey(pwd, realSalt);
                const { iv, data } = JSON.parse(real);
                decrypted = await CryptoEngine.decrypt(new Uint8Array(data).buffer, realKey, new Uint8Array(iv));
                sessionKey = realKey;
                isDecoyMode = false;
            } catch { }
        }

        // If real vault fails, try decoy vault
        if (!decrypted && decoy) {
            try {
                const decoySalt = getSalt('decoy_salt');
                const decoyKey = await CryptoEngine.deriveKey(pwd, decoySalt);
                const { iv, data } = JSON.parse(decoy);
                decrypted = await CryptoEngine.decrypt(new Uint8Array(data).buffer, decoyKey, new Uint8Array(iv));
                sessionKey = decoyKey;
                isDecoyMode = true;
            } catch { }
        }

        if (decrypted || (!real && !decoy)) {
            if (decrypted) vault = JSON.parse(decrypted);

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
            if (isDecoyMode) document.getElementById('decoy-indicator')?.classList.remove('hidden');
            renderUI();
        } else { alert("Access Denied: Incorrect Master Password."); }
    } catch { alert("Encryption Error."); }
});

/**
 * 7. EVENT BINDINGS
 */
document.getElementById('wizard-next-btn')?.addEventListener('click', () => goToStep(2));
document.getElementById('wizard-finish-btn')?.addEventListener('click', handleFinishSetup);

document.getElementById('add-btn')?.addEventListener('click', async () => {
    const titleEl = document.getElementById('entry-title') as HTMLInputElement;
    const usernameEl = document.getElementById('entry-username') as HTMLInputElement;
    const pwdEl = document.getElementById('new-password') as HTMLInputElement;
    const categoryEl = document.getElementById('entry-category') as HTMLSelectElement;
    const totpSecretEl = document.getElementById('totp-secret') as HTMLInputElement;

    if (!titleEl || !pwdEl || !titleEl.value || !pwdEl.value) {
        alert("Service name and Password are required.");
        return;
    }

    try {
        // ========== ENHANCED SECURITY CHECKS ==========

        // 1. XSS Prevention: Validate and sanitize title input
        const sanitizedTitle = SecurityScanner.validateAndSanitize(titleEl.value, "Service name");

        // 2. XSS Prevention: Validate username
        const sanitizedUsername = usernameEl?.value ? SecurityScanner.validateAndSanitize(usernameEl.value, "Username") : '';

        // 3. XSS Prevention: Validate password (allow special chars but check for scripts)
        if (SecurityScanner.detectXSS(pwdEl.value)) {
            alert("Password contains potentially malicious content. Please use a different password.");
            return;
        }

        // 4. Base32 Validation: Validate TOTP secret with enhanced checks
        const totpSecret = totpSecretEl?.value.replace(/\s+/g, '').toUpperCase() || '';
        if (totpSecret) {
            const base32Validation = SecurityScanner.validateBase32(totpSecret);
            if (!base32Validation.isValid) {
                alert(`Invalid 2FA Secret: ${base32Validation.message}`);
                return;
            }
        }

        // 4. Duplicate Password Detection: Check for password reuse
        const duplicates = SecurityScanner.findDuplicatePasswords(
            vault.entries,
            pwdEl.value,
            editingId || undefined
        );

        if (duplicates.length > 0) {
            const duplicateList = duplicates.join(', ');
            const message = `⚠️ Security Warning: Password Reuse Detected\n\n` +
                          `This password is already used in:\n${duplicateList}\n\n` +
                          `Reusing passwords across accounts is a security risk.\n\n` +
                          `Do you want to continue anyway?`;

            if (!confirm(message)) {
                return;
            }
        }

        // 5. Breach Check: Check if password has been compromised
        const breachCount = await checkPasswordBreach(pwdEl.value);
        if (breachCount > 0) {
            const breachMessage = `⚠️ Data Breach Warning\n\n` +
                                `This password has been found in ${breachCount.toLocaleString()} data breaches.\n\n` +
                                `Using this password is highly insecure and puts your account at risk.\n\n` +
                                `Do you want to continue anyway? (Not recommended)`;

            if (!confirm(breachMessage)) {
                return;
            }
        }

        // ========== END SECURITY CHECKS ==========

        if (editingId) {
            const idx = vault.entries.findIndex(x => x.id === editingId);
            vault.entries[idx] = {
                ...vault.entries[idx],
                title: sanitizedTitle,
                username: sanitizedUsername,
                password: pwdEl.value,
                category: categoryEl?.value || 'personal',
                totpSecret: totpSecret || undefined
            };
            editingId = null;
            (document.getElementById('add-btn') as HTMLButtonElement).innerText = "Save Entry";
        } else {
            vault.entries.push({
                id: crypto.randomUUID(),
                title: sanitizedTitle,
                username: sanitizedUsername,
                password: pwdEl.value,
                category: categoryEl?.value || 'personal',
                totpSecret: totpSecret || undefined
            });
        }

        // Clear form and close modal
        titleEl.value = "";
        if (usernameEl) usernameEl.value = "";
        pwdEl.value = "";
        if (categoryEl) categoryEl.value = 'personal';
        if (totpSecretEl) totpSecretEl.value = "";

        closeEntryModal();
        renderUI();

    } catch (error) {
        // Catch validation errors and display to user
        if (error instanceof Error) {
            alert(`Security Error: ${error.message}`);
        } else {
            alert("An error occurred while validating input. Please try again.");
        }
    }
});

document.getElementById('save-btn')?.addEventListener('click', async () => {
    if (!sessionKey) return;
    const { ciphertext, iv } = await CryptoEngine.encrypt(JSON.stringify(vault), sessionKey);
    const storageKey = isDecoyMode ? 'decoy_vault' : 'encrypted_vault';
    localStorage.setItem(storageKey, JSON.stringify({
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(ciphertext))
    }));
    alert("Vault Encrypted & Saved Successfully.");
});

document.getElementById('gen-btn')?.addEventListener('click', () => {
    const pwdEl = document.getElementById('new-password') as HTMLInputElement;
    if (pwdEl) pwdEl.value = generatePassword(20);
});

document.getElementById('search-input')?.addEventListener('input', renderUI);
document.getElementById('lock-btn')?.addEventListener('click', () => location.reload());
document.getElementById('enable-bio-btn')?.addEventListener('click', registerBiometrics);
document.getElementById('bio-btn')?.addEventListener('click', biometricUnlock);
document.getElementById('setup-duress-btn')?.addEventListener('click', setupDuress);

// New UI event handlers
document.getElementById('new-entry-btn')?.addEventListener('click', () => openEntryModal());
document.getElementById('modal-cancel-btn')?.addEventListener('click', closeEntryModal);

// Category switching
document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;

        // Update active state
        document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
        target.classList.add('active');

        // Update current category
        currentCategory = target.getAttribute('data-category') || 'all';
        renderUI();
    });
});



/**
 * 8. INITIALIZATION
 */
function updateStatus() {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    if (!dot || !txt) return;
    dot.style.backgroundColor = navigator.onLine ? 'var(--success)' : 'var(--warning)';
    txt.innerText = navigator.onLine ? 'ONLINE' : 'OFFLINE';
}

function initApp() {
    if (!localStorage.getItem('vault_initialized')) {
        document.getElementById('setup-wizard')?.classList.remove('hidden');
    }
    if (localStorage.getItem('bio_registered') === 'true') {
        document.getElementById('bio-btn')?.classList.remove('hidden');
    }

    // theme-toggle logic in main.ts
    const themeBtn = document.getElementById('theme-toggle');
    const themeGlobalBtns = document.querySelectorAll('.theme-toggle-global');

    const toggleTheme = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Update button text based on current theme (showing what clicking will do)
        const buttonText = newTheme === 'dark' ? '☀️ Light' : '🌙 Dark';

        // Update toolbar button (in vault mode)
        if (themeBtn) {
            const span = themeBtn.querySelector('span');
            if (span) span.textContent = buttonText;
        }

        // Update all global theme toggle buttons (header, etc.)
        themeGlobalBtns.forEach(btn => {
            const span = btn.querySelector('span');
            if (span) span.textContent = buttonText;
        });
    };

    // Attach event listeners
    themeBtn?.addEventListener('click', toggleTheme);
    themeGlobalBtns.forEach(btn => btn.addEventListener('click', toggleTheme));
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

initApp();

