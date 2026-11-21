/**
 * Scheduled cache refresh — runs inside the Next.js server process.
 * Fires a full refresh at 08, 11, 14, 17, 20, 23 (local time).
 * Outside those hours (22:00–08:00) no refresh is scheduled.
 *
 * Import this module once at server startup via instrumentation.ts.
 * Node.js module caching ensures the interval is registered only once.
 */

import { refreshAll } from '@/lib/cacheRefresher';

const REFRESH_HOURS = new Set([8, 11, 14, 17, 20, 23]);
const ACTIVE_START = 8;   // 08:00
const ACTIVE_END   = 23;  // last refresh fires at 23:00; nothing after that

let schedulerStarted = false;

function getNextRefreshMs(): number {
    const now = Date.now();

    // Build candidate timestamps for today's remaining refresh slots
    const today = new Date();
    const candidates: number[] = [];

    for (const rh of REFRESH_HOURS) {
        const t = new Date(today);
        t.setHours(rh, 0, 0, 0);
        const diff = t.getTime() - now;
        if (diff > 0) candidates.push(t.getTime()); // strictly in the future
    }

    if (candidates.length === 0) {
        // All today's slots passed — next is tomorrow at ACTIVE_START
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(ACTIVE_START, 0, 0, 0);
        return tomorrow.getTime() - now;
    }

    return Math.min(...candidates) - now;
}

function scheduleNext(): void {
    const delayMs = getNextRefreshMs();

    const fireAt = new Date(Date.now() + delayMs);
    const hh = fireAt.getHours().toString().padStart(2, '0');
    const mm = fireAt.getMinutes().toString().padStart(2, '0');
    console.log(`[cacheScheduler] next refresh at ${hh}:${mm} (in ${Math.round(delayMs / 60000)} min)`);

    setTimeout(async () => {
        const hour = new Date().getHours();
        if (hour >= ACTIVE_START && hour <= ACTIVE_END) {
            console.log(`[cacheScheduler] running scheduled refresh`);
            try {
                await refreshAll();
            } catch (err) {
                console.error('[cacheScheduler] refresh failed:', err);
            }
        }
        scheduleNext();
    }, delayMs);
}

export function startCacheScheduler(): void {
    if (schedulerStarted) return;
    schedulerStarted = true;
    console.log('[cacheScheduler] started');
    scheduleNext();
}
