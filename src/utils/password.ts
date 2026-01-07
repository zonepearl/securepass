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

/**
 * Returns a label and color based on entropy bit-strength.
 */
export const getStrengthLabel = (entropy: number) => {
  if (entropy < 40) return { label: 'Weak', color: '#ef4444' };      // Red
  if (entropy < 60) return { label: 'Fair', color: '#f59e0b' };      // Orange
  if (entropy < 80) return { label: 'Good', color: '#10b981' };      // Green
  return { label: 'Excellent', color: '#3b82f6' };                   // Blue
};

/**
 * Generates a cryptographically secure random string.
 * Uses Web Crypto API instead of Math.random().
 */
export const generatePassword = (length: number = 20): string => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let retVal = "";
  
  // Create an array of random 32-bit unsigned integers
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    // Map the random integer to our character set
    retVal += charset.charAt(randomValues[i] % charset.length);
  }
  
  return retVal;
};