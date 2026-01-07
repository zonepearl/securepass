export async function checkPasswordBreach(password: string): Promise<number> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    try {
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        const text = await response.text();
        const lines = text.split('\n');
        
        for (const line of lines) {
            const [lineSuffix, count] = line.split(':');
            if (lineSuffix === suffix) {
                return parseInt(count);
            }
        }
    } catch (e) {
        console.error("Breach check failed", e);
    }
    return 0;
}