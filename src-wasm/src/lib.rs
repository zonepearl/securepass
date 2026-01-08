// --- 1. Imports ---
// wasm_bindgen is the bridge between JavaScript and Rust.
use wasm_bindgen::prelude::*;

// Specialized cryptographic libraries (Crates)
use argon2::Argon2; // Memory-hard key derivation
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
}; // Authenticated encryption (Modern standard)
use zeroize::Zeroize; // Security: physically wipes sensitive data from RAM
use rand::{Rng, seq::SliceRandom}; // Secure randomness from the OS/Hardware
use totp_rs::{Algorithm, TOTP, Secret}; // 2FA/TOTP logic
use serde::{Deserialize, Serialize}; // Translates between JSON and Rust Data Types

/// --- 2. Data Structures ---
/// This struct defines the settings for our password generator.
/// #[wasm_bindgen] tells Rust to prepare this for use in JavaScript.
#[wasm_bindgen]
#[derive(Serialize, Deserialize)]
pub struct PasswordOptions {
    pub length: usize,
    pub use_uppercase: bool,
    pub use_numbers: bool,
    pub use_symbols: bool,
}

/// The main "Bridge" that stays alive in the browser's memory.
/// It holds the 'master_key' which is derived from your master password.
#[wasm_bindgen]
pub struct CryptoBridge {
    master_key: [u8; 32],
}

#[wasm_bindgen]
impl CryptoBridge {
    /// CONSTRUCTOR: Creates a new bridge.
    /// It takes your password and a unique "salt", then runs Argon2id.
    #[wasm_bindgen(constructor)]
    pub fn new(password: &str, salt: &[u8]) -> Result<CryptoBridge, JsValue> {
        // We use an _internal version so we can test it without Wasm
        Self::new_internal(password, salt).map_err(|e| JsValue::from_str(&e))
    }

    /// The actual logic for deriving the vault's master key.
    fn new_internal(password: &str, salt: &[u8]) -> Result<CryptoBridge, String> {
        let mut master_key = [0u8; 32];
        let argon2 = Argon2::default(); // Uses Argon2id (the modern industry standard)
        
        // This line does the heavy lifting: turning a readable password into raw binary bytes.
        argon2.hash_password_into(password.as_bytes(), salt, &mut master_key)
            .map_err(|e| format!("Argon2 error: {}", e))?;

        Ok(CryptoBridge { master_key })
    }

    /// ENCRYPT: Seals a piece of text using the master key.
    /// 'iv' is a unique random number that makes the result different every time.
    pub fn encrypt(&self, plaintext: &str, iv: &[u8]) -> Result<Vec<u8>, JsValue> {
        self.encrypt_internal(plaintext, iv).map_err(|e| JsValue::from_str(&e))
    }

    fn encrypt_internal(&self, plaintext: &str, iv: &[u8]) -> Result<Vec<u8>, String> {
        // Initialize the AES-256-GCM cipher using our master key
        let cipher = Aes256Gcm::new_from_slice(&self.master_key)
            .map_err(|e| format!("Cipher init error: {}", e))?;
        
        let nonce = Nonce::from_slice(iv); // Nonce is just another word for IV
        
        // Perform the encryption
        let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("Encryption error: {}", e))?;
            
        Ok(ciphertext)
    }

    /// DECRYPT: Unseals encrypted data.
    pub fn decrypt(&self, ciphertext: &[u8], iv: &[u8]) -> Result<String, JsValue> {
        self.decrypt_internal(ciphertext, iv).map_err(|e| JsValue::from_str(&e))
    }

    fn decrypt_internal(&self, ciphertext: &[u8], iv: &[u8]) -> Result<String, String> {
        let cipher = Aes256Gcm::new_from_slice(&self.master_key)
            .map_err(|e| format!("Cipher init error: {}", e))?;
            
        let nonce = Nonce::from_slice(iv);
        
        // Decrypt the binary data back into a vector of bytes
        let plaintext_vec = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption error: {}", e))?;
            
        // Convert the bytes back into a readable UTF-8 string
        String::from_utf8(plaintext_vec)
            .map_err(|e| format!("UTF-8 error: {}", e))
    }

    /// GENERATOR: Creates a high-entropy random password.
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    pub fn generate_password(&self, options_val: JsValue) -> Result<String, JsValue> {
        // Convert the JavaScript "Options" object into our Rust struct
        let options: PasswordOptions = serde_wasm_bindgen::from_value(options_val)
            .map_err(|e| JsValue::from_str(&format!("Options parse error: {}", e)))?;
            
        Ok(self.generate_password_core(options))
    }

    /// The core logic for generating passwords with guaranteed diversity.
    fn generate_password_core(&self, options: PasswordOptions) -> String {
        let lowercase = "abcdefghijklmnopqrstuvwxyz";
        let uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let numbers = "0123456789";
        let symbols = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

        let mut charset = lowercase.to_string();
        let mut guaranteed_chars = Vec::new();
        let mut rng = rand::thread_rng(); // Secure random generator

        // To guarantee diversity, we pick one char from each ENABLED type first
        guaranteed_chars.push(lowercase.chars().nth(rng.gen_range(0..lowercase.len())).unwrap());

        if options.use_uppercase { 
            charset.push_str(uppercase);
            guaranteed_chars.push(uppercase.chars().nth(rng.gen_range(0..uppercase.len())).unwrap());
        }
        if options.use_numbers { 
            charset.push_str(numbers);
            guaranteed_chars.push(numbers.chars().nth(rng.gen_range(0..numbers.len())).unwrap());
        }
        if options.use_symbols { 
            charset.push_str(symbols);
            guaranteed_chars.push(symbols.chars().nth(rng.gen_range(0..symbols.len())).unwrap());
        }

        // Fill the rest of the password length with random chars from the full set
        if options.length < guaranteed_chars.len() {
            return guaranteed_chars.into_iter().take(options.length).collect();
        }

        let mut pwd_chars: Vec<char> = (0..(options.length - guaranteed_chars.len()))
            .map(|_| {
                let idx = rng.gen_range(0..charset.len());
                charset.chars().nth(idx).unwrap()
            })
            .collect();
        
        // Add our guaranteed chars back in and shuffle them so they aren't always at the end
        pwd_chars.extend(guaranteed_chars);
        pwd_chars.shuffle(&mut rng);
        pwd_chars.into_iter().collect()
    }

    /// MAC-STYLE: Generates passwords like "abc12x-def45y-ghi78z"
    pub fn generate_mac_password(&self) -> String {
        let charset = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let mut rng = rand::thread_rng();
        
        let mut generate_block = || {
            (0..6)
                .map(|_| {
                    let idx = rng.gen_range(0..charset.len());
                    charset.chars().nth(idx).unwrap()
                })
                .collect::<String>()
        };

        format!("{}-{}-{}", generate_block(), generate_block(), generate_block())
    }

    /// PASSPHRASE: Generates memorable word-based passwords.
    pub fn generate_passphrase(&self) -> String {
        let words = vec![
            "azure", "bright", "cloud", "dance", "eagle", "forest", "glory", "honey", "island", "jungle",
            "knight", "lemon", "mountain", "night", "ocean", "pearl", "quartz", "river", "silver", "tiger",
            "unique", "valley", "winter", "xenon", "yellow", "zebra", "alpha", "bravo", "cactus", "delta",
            "echo", "frost", "garden", "harvest", "icon", "jade", "karma", "lunar", "magic", "nebula",
            "orbit", "plasma", "quest", "rocket", "solar", "terra", "ultra", "vivid", "wave", "yield"
        ];

        let mut rng = rand::thread_rng();
        (0..4)
            .map(|_| *words.choose(&mut rng).unwrap())
            .collect::<Vec<_>>()
            .join("-")
    }

    /// 2FA: Calculates the current 6-digit TOTP code.
    pub fn get_totp_code(&self, secret: &str) -> Result<String, JsValue> {
        self.get_totp_code_internal(secret).map_err(|e| JsValue::from_str(&e))
    }

    fn get_totp_code_internal(&self, secret: &str) -> Result<String, String> {
        // Parse the secret (usually a Base32 string)
        let secret_bytes = Secret::Encoded(secret.to_string())
            .to_bytes()
            .map_err(|e| format!("TOTP bytes error: {}", e))?;

        // Initialize the TOTP object with standard settings (SHA1, 6 digits, 30s)
        let totp = TOTP::new(
            Algorithm::SHA1,
            6,
            1,
            30,
            secret_bytes,
        ).map_err(|e| format!("TOTP init error: {}", e))?;
        
        Ok(totp.generate_current().map_err(|e| format!("TOTP generation error: {}", e))?)
    }

    /// HISTORY: Manages the "Sliding Window" of previous passwords.
    pub fn rotate_history(&self, current_password: &str, history_json: &str) -> Result<String, JsValue> {
        self.rotate_history_internal(current_password, history_json).map_err(|e| JsValue::from_str(&e))
    }

    fn rotate_history_internal(&self, current_password: &str, history_json: &str) -> Result<String, String> {
        // Deserialize the JSON string back into a Rust Vector (List)
        let mut history: Vec<String> = serde_json::from_str(history_json)
            .map_err(|e| format!("History parse error: {}", e))?;
            
        // Insert at the front (index 0)
        history.insert(0, current_password.to_string());
        
        // Keep only the most recent 5
        if history.len() > 5 {
            history.truncate(5);
        }
        
    serde_json::to_string(&history)
            .map_err(|e| format!("History serialize error: {}", e))
    }
}

/// --- 3. Standalone Biometric Logic ---
/// These don't require an active bridge because they deal with derivation.

#[wasm_bindgen]
pub fn derive_bio_key(credential_id: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut key = [0u8; 32];
    let argon2 = Argon2::default();
    
    // We use a fixed salt for biometric key derivation so it's consistent across sessions.
    let salt = b"WebVault_BioSalt"; 
    
    argon2.hash_password_into(credential_id, salt, &mut key)
        .map_err(|e| JsValue::from_str(&format!("Argon2 error: {}", e)))?;
        
    Ok(key.to_vec())
}

/// WRAP: Encrypts the master password so it can be stored in browser storage safely.
#[wasm_bindgen]
pub fn wrap_password(password: &str, bio_key: &[u8], iv: &[u8]) -> Result<Vec<u8>, JsValue> {
    let cipher = Aes256Gcm::new_from_slice(bio_key)
        .map_err(|e| JsValue::from_str(&format!("Cipher init error: {}", e)))?;
        
    let nonce = Nonce::from_slice(iv);
    
    let ciphertext = cipher.encrypt(nonce, password.as_bytes())
        .map_err(|e| JsValue::from_str(&format!("Wrapping error: {}", e)))?;
        
    Ok(ciphertext)
}

/// UNWRAP: Decrypts the master password when you use TouchID/FaceID.
#[wasm_bindgen]
pub fn unwrap_password(wrapped_data: &[u8], bio_key: &[u8], iv: &[u8]) -> Result<String, JsValue> {
    let cipher = Aes256Gcm::new_from_slice(bio_key)
        .map_err(|e| JsValue::from_str(&format!("Cipher init error: {}", e)))?;
        
    let nonce = Nonce::from_slice(iv);
    
    let plaintext_vec = cipher.decrypt(nonce, wrapped_data)
        .map_err(|e| JsValue::from_str(&format!("Unwrapping error: {}", e)))?;
        
    String::from_utf8(plaintext_vec)
        .map_err(|e| JsValue::from_str(&format!("UTF-8 error: {}", e)))
}

/// --- 4. Memory Security (Cleanup) ---
/// This is a CRITICAL security feature. 
/// When the 'CryptoBridge' object is destroyed, we physically wipe the master key from memory.
impl Drop for CryptoBridge {
    fn drop(&mut self) {
        self.master_key.zeroize(); // Overwrites the key with zeros in RAM
    }
}

// --- 5. Unit Tests ---
// These ensure that the "Engine" is working perfectly before we even connect it to the web.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let password = "master-password";
        let salt = b"some-salt-123456";
        let bridge = CryptoBridge::new_internal(password, salt).unwrap();
        assert_eq!(bridge.master_key.len(), 32);
        
        let bridge2 = CryptoBridge::new_internal(password, salt).unwrap();
        assert_eq!(bridge.master_key, bridge2.master_key);
    }

    #[test]
    fn test_encrypt_decrypt() {
        let bridge = CryptoBridge::new_internal("pwd", b"salt-123456789012").unwrap();
        let plaintext = "Sensitive data to protect";
        let iv = [0u8; 12];
        
        let ciphertext = bridge.encrypt_internal(plaintext, &iv).unwrap();
        assert_ne!(ciphertext, plaintext.as_bytes());
        
        let decrypted = bridge.decrypt_internal(&ciphertext, &iv).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_password_generation() {
        let bridge = CryptoBridge::new_internal("p", b"salt-123456789012").unwrap();
        let options = PasswordOptions {
            length: 16,
            use_uppercase: true,
            use_numbers: true,
            use_symbols: false,
        };
        let pwd = bridge.generate_password_core(options);
        assert_eq!(pwd.len(), 16);
        assert!(pwd.chars().any(|c| c.is_uppercase()));
        assert!(pwd.chars().any(|c| c.is_numeric()));
    }

    #[test]
    fn test_password_format_mac() {
        let bridge = CryptoBridge::new_internal("p", b"salt-123456789012").unwrap();
        let pwd = bridge.generate_mac_password();
        assert_eq!(pwd.len(), 20); 
        assert_eq!(pwd.chars().filter(|&c| c == '-').count(), 2);
    }

    #[test]
    fn test_passphrase() {
        let bridge = CryptoBridge::new_internal("p", b"salt-123456789012").unwrap();
        let phrase = bridge.generate_passphrase();
        let words: Vec<&str> = phrase.split('-').collect();
        assert_eq!(words.len(), 4);
    }

    #[test]
    fn test_totp_generation() {
        let bridge = CryptoBridge::new_internal("p", b"salt-123456789012").unwrap();
        let secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"; 
        let code = bridge.get_totp_code_internal(secret).unwrap();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_digit(10)));
    }

    #[test]
    fn test_history_rotation() {
        let bridge = CryptoBridge::new_internal("p", b"salt-123456789012").unwrap();
        let history_json = "[\"old1\", \"old2\"]";
        let new_history = bridge.rotate_history_internal("new_pwd", history_json).unwrap();
        
        let parsed: Vec<String> = serde_json::from_str(&new_history).unwrap();
        assert_eq!(parsed[0], "new_pwd");
        assert_eq!(parsed[1], "old1");
        assert_eq!(parsed.len(), 3);
        
        let full_history = "[\"1\", \"2\", \"3\", \"4\", \"5\"]";
        let rotated = bridge.rotate_history_internal("6", full_history).unwrap();
        let parsed_full: Vec<String> = serde_json::from_str(&rotated).unwrap();
        assert_eq!(parsed_full.len(), 5);
        assert_eq!(parsed_full[0], "6");
        assert_eq!(parsed_full[4], "4");
    }

    #[test]
    fn test_biometric_wrapping() {
        let credential_id = b"test-credential-id";
        let password = "super-secret-master-password";
        let iv = [1u8; 12];
        
        let bio_key = derive_bio_key(credential_id).unwrap();
        assert_eq!(bio_key.len(), 32);
        
        let wrapped = wrap_password(password, &bio_key, &iv).unwrap();
        assert_ne!(wrapped, password.as_bytes());
        
        let unwrapped = unwrap_password(&wrapped, &bio_key, &iv).unwrap();
        assert_eq!(unwrapped, password);
    }
}
