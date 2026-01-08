import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AutoLockService } from './AutoLockService.js';

describe('AutoLockService', () => {
    let service: AutoLockService;
    let lockCallback: () => void;

    beforeEach(() => {
        vi.useFakeTimers();
        lockCallback = vi.fn();
        // Clear localStorage before each test
        localStorage.clear();
        service = new AutoLockService(lockCallback);
    });

    afterEach(() => {
        service.stop();
        vi.restoreAllMocks();
    });

    it('should initialize with default duration (5 minutes)', () => {
        expect(service.getDuration()).toBe(300000);
    });

    it('should call lock callback after timeout', () => {
        service.start();
        vi.advanceTimersByTime(300000);
        expect(lockCallback).toHaveBeenCalled();
    });

    it('should reset timer on activity', () => {
        service.start();
        vi.advanceTimersByTime(200000); // 3:20 gone

        // Simulate activity
        document.dispatchEvent(new MouseEvent('mousemove'));

        vi.advanceTimersByTime(200000); // Another 3:20 gone (total 6:40)
        // Should NOT have locked yet because it reset at 200s
        expect(lockCallback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100000); // Total 5 mins since reset
        expect(lockCallback).toHaveBeenCalled();
    });

    it('should respect duration change', () => {
        service.setDuration(60000); // 1 minute
        expect(service.getDuration()).toBe(60000);

        service.start();
        vi.advanceTimersByTime(60000);
        expect(lockCallback).toHaveBeenCalled();
    });

    it('should persist duration to localStorage', () => {
        service.setDuration(900000); // 15 mins
        expect(localStorage.getItem('autolock_duration')).toBe('900000');
    });

    it('should stop timer when stopped', () => {
        service.start();
        service.stop();
        vi.advanceTimersByTime(300000);
        expect(lockCallback).not.toHaveBeenCalled();
    });
});
