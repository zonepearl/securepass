export const SecurityScanner = {
    escapeHTML(str: string): string {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    detectInjection(input: string): boolean {
        const patterns = [/<script.*?>.*?<\/script>/gim, /' OR '1'='1/gim, /--/g];
        return patterns.some(pattern => pattern.test(input));
    },
    sanitizeInput(input: string): string {
        return input.replace(/[\x00-\x1F\x7F]/g, "").trim();
    },
    validatePassword(pwd: string) {
        return {
            isValid: pwd.length >= 12,
            message: pwd.length < 12 ? "Password must be at least 12 characters." : ""
        };
    }
};