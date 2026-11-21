export async function register() {
    // Only run in Node.js runtime (not Edge), and only once per process.
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startCacheScheduler } = await import('@/lib/cacheScheduler');
        startCacheScheduler();
    }
}
