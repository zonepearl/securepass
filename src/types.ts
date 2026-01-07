/**
 * Represents a single credential entry in the vault.
 */
export interface VaultEntry {
  id: string;             // Unique identifier (UUID)
  title: string;          // Name of the service (e.g., GitHub)
  username: string;       // Login identity
  password: string;       // The sensitive secret
  url: string;            // Login page link
  notes: string;          // Additional encrypted details
  category: string;       // Folder/Tag for organization
  lastModified: number;   // Unix timestamp for sync conflict resolution
}

/**
 * The root structure of the decrypted vault.
 * This object is stringified and then encrypted as a single blob.
 */
export interface VaultSchema {
  version: number;        // Schema version for future data migrations
  lastSync: number;       // Last time the vault was saved
  entries: VaultEntry[];  // Array of all stored credentials
  categories: string[];   // User-defined organizational categories
}

/**
 * Structure used for storing the encrypted vault in LocalStorage or a Database.
 */
export interface EncryptedPackage {
  iv: number[];           // Initialization Vector (stored as array for JSON)
  data: number[];         // Ciphertext (stored as array for JSON)
}