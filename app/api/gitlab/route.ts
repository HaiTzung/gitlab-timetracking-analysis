import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached, TTL } from '@/lib/cache';

export async function POST(request: NextRequest) {
    const token = process.env.GITLAB_TOKEN;
    const apiUrl = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/graphql';

    if (!token) {
        return NextResponse.json({ error: 'GITLAB_TOKEN not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { cacheKey, ttlMs, bust, ...gitlabBody } = body as {
        cacheKey?: string;
        ttlMs?: number;
        bust?: boolean;
        query: string;
        variables?: Record<string, unknown>;
    };

    // Serve from cache if available and not busting
    if (cacheKey && !bust) {
        const cached = getCached(cacheKey);
        if (cached) {
            return NextResponse.json({ ...cached.data as object, _fetchedAt: cached.fetchedAt, _fromCache: true });
        }
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(gitlabBody),
    });

    const data = await response.json();

    if (response.ok && cacheKey) {
        const resolvedTtl = ttlMs ?? TTL.DEFAULT;
        setCached(cacheKey, data, resolvedTtl);
    }

    const fetchedAt = Date.now();
    return NextResponse.json({ ...data, _fetchedAt: fetchedAt, _fromCache: false }, { status: response.status });
}
