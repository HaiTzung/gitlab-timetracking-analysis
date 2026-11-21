interface CacheEntry {
    data: unknown;
    fetchedAt: number;
    ttlMs: number;
}

// Module-level singleton — persists across requests in the same Next.js server process.
const store = new Map<string, CacheEntry>();

export const TTL = {
    PAST_TIMELOGS: 24 * 60 * 60 * 1000,   // 24h — past weeks are immutable
    CURRENT_TIMELOGS: 2 * 60 * 60 * 1000, // 2h — survives between hourly refreshes
    ISSUES: 2 * 60 * 60 * 1000,           // 2h
    EPICS: 2 * 60 * 60 * 1000,            // 2h
    MILESTONES: 2 * 60 * 60 * 1000,       // 2h
    WORK_ITEM_STATUSES: 2 * 60 * 60 * 1000, // 2h
    ISSUE_NOTES: 2 * 60 * 60 * 1000,      // 2h
    DEFAULT: 2 * 60 * 60 * 1000,          // 2h
} as const;

export function getCached(key: string): { data: unknown; fetchedAt: number } | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttlMs) {
        store.delete(key);
        return null;
    }
    return { data: entry.data, fetchedAt: entry.fetchedAt };
}

export function setCached(key: string, data: unknown, ttlMs: number, fetchedAt = Date.now()): void {
    store.set(key, { data, fetchedAt, ttlMs });
}

export function bustCache(key?: string): void {
    if (key) {
        store.delete(key);
    } else {
        store.clear();
    }
}

export interface CacheEntryMetadata {
    fetchedAt: number;
    ttlMs: number;
    ageMs: number;
    expiresInMs: number;
}

export function getCacheMetadata(): Record<string, CacheEntryMetadata> {
    const now = Date.now();
    const result: Record<string, CacheEntryMetadata> = {};
    for (const [key, entry] of store.entries()) {
        const ageMs = now - entry.fetchedAt;
        if (ageMs <= entry.ttlMs) {
            result[key] = {
                fetchedAt: entry.fetchedAt,
                ttlMs: entry.ttlMs,
                ageMs,
                expiresInMs: entry.ttlMs - ageMs,
            };
        } else {
            store.delete(key);
        }
    }
    return result;
}
