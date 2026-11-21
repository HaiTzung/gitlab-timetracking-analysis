interface CacheEntry {
    data: unknown;
    fetchedAt: number;
    ttlMs: number;
}

// Module-level singleton — persists across requests in the same Next.js server process.
const store = new Map<string, CacheEntry>();

export const TTL = {
    PAST_TIMELOGS: 24 * 60 * 60 * 1000,   // 24h — past weeks are immutable
    CURRENT_TIMELOGS: 10 * 60 * 1000,      // 10 min
    ISSUES: 10 * 60 * 1000,
    EPICS: 10 * 60 * 1000,
    MILESTONES: 10 * 60 * 1000,
    WORK_ITEM_STATUSES: 5 * 60 * 1000,
    ISSUE_NOTES: 10 * 60 * 1000,
    DEFAULT: 10 * 60 * 1000,
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
