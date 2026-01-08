/**
 * Calculates bits of entropy based on character pool size and length.
 * Formula: E = L * log2(R)
 */
export const calculateEntropy = (password: string): number => {
  if (!password) return 0;

  let poolSize = 0;
  // Check for character sets used
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33; // Symbols/Special chars

  if (poolSize === 0) return 0;

  return password.length * Math.log2(poolSize);
};

// Strength Labeling functions kept for UI
export const getStrengthLabel = (entropy: number) => {
  if (entropy < 40) return { label: 'Weak', color: '#ef4444' };      // Red
  if (entropy < 60) return { label: 'Fair', color: '#f59e0b' };      // Orange
  if (entropy < 80) return { label: 'Good', color: '#10b981' };      // Green
  return { label: 'Excellent', color: '#3b82f6' };                   // Blue
};

// PasswordOptions kept for type safety in fallback logic
export interface PasswordOptions {
  length: number;
  useUppercase: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
}

// Random generation logic moved to Wasm. 
// Standard TS fallbacks (if needed) are now in components.