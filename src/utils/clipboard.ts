let clipboardTimeout: number | null = null;

/**
 * Copies text to the system clipboard and clears it after a delay.
 * @param text The string to copy.
 * @param durationMs How long to wait before clearing (default 30s).
 */
export const copyToClipboardSecure = async (text: string, durationMs: number = 30000): Promise<boolean> => {
  try {
    if (!navigator.clipboard) {
      throw new Error("Clipboard API not available");
    }

    // 1. Copy the text
    await navigator.clipboard.writeText(text);

    // 2. Clear any existing timer if the user copies a second item
    if (clipboardTimeout) {
      window.clearTimeout(clipboardTimeout);
    }

    // 3. Set a new timer to wipe the clipboard
    clipboardTimeout = window.setTimeout(async () => {
      try {
        // Overwrite clipboard with an empty string
        await navigator.clipboard.writeText("");
        console.log("Clipboard cleared for security.");
      } catch (err) {
        console.error("Failed to clear clipboard automatically.");
      }
      clipboardTimeout = null;
    }, durationMs);

    return true;
  } catch (err) {
    console.error("Secure copy failed:", err);
    return false;
  }
};