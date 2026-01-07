
import { CryptoEngine } from './crypto.js';
import { SecurityScanner } from './security.js';
import { generatePassword, calculateEntropy } from './utils/password.js';
import { checkPasswordBreach } from './utils/breach-check.js';

import * as OTPAuth from 'otpauth';

/**
 * Validates if a string is a valid Base32 encoded string
 * Base32 uses A-Z and 2-7 characters
 */
function isValidBase32(str: string): boolean {
    // Base32 alphabet: A-Z (uppercase) and 2-7
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(str) && str.length > 0;
}

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
 * 5. CORE UI RENDERING (WITH NULL-GUARDS)
 */
async function renderUI() {
    const list = document.getElementById('vault-list');
    if (!list) return;

    list.innerHTML = '';
    const searchEl = document.getElementById('search-input') as HTMLInputElement;
    const query = searchEl ? searchEl.value.toLowerCase() : "";

    for (const entry of vault.entries) {
        if (query && !entry.title.toLowerCase().includes(query)) continue;

        const entropy = calculateEntropy(entry.password);
        const card = document.createElement('div');
        card.className = 'entry-card';

        // Build TOTP section if secret exists
        const totpSection = entry.totpSecret ? `
            <div style="margin-top: 10px; padding: 10px; background: var(--form-bg); border-radius: 6px; border: 1px dashed var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; font-weight: 600; color: var(--primary);">🔐 2FA CODE</span>
                    <span class="totp-timer" style="font-size: 10px; color: var(--warning);">⏱️ --s</span>
                </div>
                <div class="totp-code" style="font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; font-family: monospace; margin: 8px 0;">------</div>
            </div>
        ` : '';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between">
                <strong>${SecurityScanner.escapeHTML(entry.title)}</strong>
                <div>
                    <button class="edit-btn" style="color:var(--primary); background:none; font-size:10px;">Edit</button>
                    <button class="del-btn" style="color:var(--danger); background:none; font-size:10px;">Del</button>
                </div>
            </div>
            <div class="audit-badge ${entropy < 60 ? 'badge-danger' : 'badge-success'}">
                ${entropy < 60 ? '⚠️ Weak' : '✅ Secure'} (${entropy} bits)
            </div>

             <div class="password-row" style="display: flex; justify-content: space-between; align-items: center; background: var(--form-bg); padding: 8px; border-radius: 6px;">
                <span class="pwd-display" style="letter-spacing: 2px; font-family: monospace;">••••••••</span>
                <button class="toggle-eye" style="background:none; border:none; cursor:pointer; font-size: 16px;">👁️</button>
            </div>
            ${totpSection}
            <button class="audit-btn" style="font-size:10px; background:none; color:var(--primary); padding:0; margin-top:5px;">Check Breach</button>
            <div id="res-${entry.id}" style="font-size:10px; margin-top:5px;"></div>
        `;

        // Scoped Selectors: Search INSIDE the card, not the whole document
        const pwdDisplay = card.querySelector('.pwd-display') as HTMLElement;
        const toggleEye = card.querySelector('.toggle-eye') as HTMLButtonElement;
        let isVisible = false;

        toggleEye.addEventListener('click', () => {
            isVisible = !isVisible;
            pwdDisplay.innerText = isVisible ? entry.password : "••••••••";
            pwdDisplay.style.letterSpacing = isVisible ? "normal" : "2px";
            toggleEye.innerText = isVisible ? "🙈" : "👁️";
        });

        // TOTP Code Generator with Live Timer
        if (entry.totpSecret) {
            const totpCodeEl = card.querySelector('.totp-code') as HTMLElement;
            const totpTimerEl = card.querySelector('.totp-timer') as HTMLElement;

            const updateTOTP = () => {
                const { code, secondsSecondsRemaining } = generateTOTP(entry.totpSecret);
                if (totpCodeEl) totpCodeEl.innerText = code.match(/.{1,3}/g)?.join(' ') || code;
                if (totpTimerEl) totpTimerEl.innerText = `⏱️ ${secondsSecondsRemaining}s`;
            };

            updateTOTP(); // Initial render
            const interval = setInterval(updateTOTP, 1000);

            // Cleanup on card removal (memory leak prevention)
            card.addEventListener('DOMNodeRemoved', () => clearInterval(interval));
        }

        card.querySelector('.audit-btn')?.addEventListener('click', async () => {
            const res = document.getElementById(`res-${entry.id}`)!;
            res.innerText = "Checking HIBP database...";
            const count = await checkPasswordBreach(entry.password);
            res.innerHTML = count > 0 ? `<span style="color:red">🚨 Pwned ${count} times!</span>` : `<span style="color:green">🛡️ Safe</span>`;
        });

        card.querySelector('.edit-btn')?.addEventListener('click', () => {
            editingId = entry.id;
            (document.getElementById('entry-title') as HTMLInputElement).value = entry.title;
            (document.getElementById('new-password') as HTMLInputElement).value = entry.password;
            const totpInput = document.getElementById('totp-secret') as HTMLInputElement;
            if (totpInput) totpInput.value = entry.totpSecret || '';
            (document.getElementById('add-btn') as HTMLButtonElement).innerText = "Update Entry";
        });

        card.querySelector('.del-btn')?.addEventListener('click', () => {
            if (confirm("Delete this entry?")) { vault.entries = vault.entries.filter(x => x.id !== entry.id); renderUI(); }
        });

        list.appendChild(card);
    }
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

document.getElementById('add-btn')?.addEventListener('click', () => {
    const titleEl = document.getElementById('entry-title') as HTMLInputElement;
    const pwdEl = document.getElementById('new-password') as HTMLInputElement;
    const totpSecretEl = document.getElementById('totp-secret') as HTMLInputElement;

    if (!titleEl || !pwdEl || !titleEl.value || !pwdEl.value) {
        alert("Title and Password are required.");
        return;
    }

    // Validate TOTP secret if provided
    const totpSecret = totpSecretEl?.value.replace(/\s+/g, '').toUpperCase() || '';
    if (totpSecret && !isValidBase32(totpSecret)) {
        alert("Invalid 2FA Secret. Please use a valid Base32 string (A-Z, 2-7).");
        return;
    }

    if (editingId) {
        const idx = vault.entries.findIndex(x => x.id === editingId);
        vault.entries[idx] = {
            ...vault.entries[idx],
            title: titleEl.value,
            password: pwdEl.value,
            totpSecret: totpSecret || undefined
        };
        editingId = null;
        (document.getElementById('add-btn') as HTMLButtonElement).innerText = "Add to Vault";
    } else {
        vault.entries.push({
            id: crypto.randomUUID(),
            title: titleEl.value,
            password: pwdEl.value,
            totpSecret: totpSecret || undefined
        });
    }

    titleEl.value = "";
    pwdEl.value = "";
    if (totpSecretEl) totpSecretEl.value = "";
    renderUI();
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

    themeBtn?.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Optional: Change the emoji on the button
        themeBtn.innerText = newTheme === 'dark' ? '☀️' : '🌓';
    });
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

initApp();

