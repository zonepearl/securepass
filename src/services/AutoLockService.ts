/**
 * AutoLockService
 * Manages vault inactivity timeout and triggers locking.
 */
export class AutoLockService {
    private timeoutId: any = null;
    private timeoutDuration: number = 5 * 60 * 1000; // Default 5 minutes
    private onLock: () => void;

    constructor(onLock: () => void) {
        this.onLock = onLock;
        this.loadSettings();
        this.initEventListeners();
    }

    private loadSettings(): void {
        const saved = localStorage.getItem('autolock_duration');
        if (saved) {
            this.timeoutDuration = parseInt(saved, 10);
        }
    }

    private initEventListeners(): void {
        const resetEvents = ['mousemove', 'keydown', 'click', 'touchstart'];
        resetEvents.forEach(event => {
            document.addEventListener(event, () => this.resetTimer());
        });
    }

    public start(): void {
        if (this.timeoutDuration === 0) return; // "Never" setting
        this.resetTimer();
    }

    public stop(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    public setDuration(ms: number): void {
        this.timeoutDuration = ms;
        localStorage.setItem('autolock_duration', ms.toString());
        this.resetTimer();
    }

    public getDuration(): number {
        return this.timeoutDuration;
    }

    private resetTimer(): void {
        this.stop();
        if (this.timeoutDuration > 0) {
            this.timeoutId = setTimeout(() => {
                this.onLock();
            }, this.timeoutDuration);
        }
    }
}
