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
export interface PasswordOptions {
  length: number;
  useUppercase: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
}

export const generatePassword = (options: PasswordOptions): string => {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

  let charset = lowercase;
  if (options.useUppercase) charset += uppercase;
  if (options.useNumbers) charset += numbers;
  if (options.useSymbols) charset += symbols;

  let retVal = "";
  const randomValues = new Uint32Array(options.length);
  window.crypto.getRandomValues(randomValues);

  for (let i = 0; i < options.length; i++) {
    retVal += charset.charAt(randomValues[i] % charset.length);
  }

  return retVal;
};

/**
 * Generates a Mac-style password (xxxxxx-xxxxxx-xxxxxx)
 */
export const generateMacPassword = (): string => {
  const charset = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars like O, 0, I, l
  const generateBlock = () => {
    let block = "";
    const randomValues = new Uint32Array(6);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < 6; i++) {
      block += charset.charAt(randomValues[i] % charset.length);
    }
    return block;
  };

  return `${generateBlock()}-${generateBlock()}-${generateBlock()}`;
};

/**
 * Generates a memorable passphrase
 */
export const generatePassphrase = (): string => {
  const words = [
    "azure", "bright", "cloud", "dance", "eagle", "forest", "glory", "honey", "island", "jungle",
    "knight", "lemon", "mountain", "night", "ocean", "pearl", "quartz", "river", "silver", "tiger",
    "unique", "valley", "winter", "xenon", "yellow", "zebra", "alpha", "bravo", "cactus", "delta",
    "echo", "frost", "garden", "harvest", "icon", "jade", "karma", "lunar", "magic", "nebula",
    "orbit", "plasma", "quest", "rocket", "solar", "terra", "ultra", "vivid", "wave", "yield"
  ];

  const randomValues = new Uint32Array(4);
  window.crypto.getRandomValues(randomValues);

  return Array.from(randomValues).map(v => words[v % words.length]).join('-');
};