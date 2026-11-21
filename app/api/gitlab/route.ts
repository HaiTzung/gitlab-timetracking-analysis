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

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        return NextResponse.json(
            { error: `GitLab API error ${response.status}`, detail: text },
            { status: response.status },
        );
    }

    const data = await response.json();
    const fetchedAt = Date.now();

    if (cacheKey) {
        const resolvedTtl = ttlMs ?? TTL.DEFAULT;
        setCached(cacheKey, data, resolvedTtl, fetchedAt);
    }

    return NextResponse.json({ ...data, _fetchedAt: fetchedAt, _fromCache: false });
}
