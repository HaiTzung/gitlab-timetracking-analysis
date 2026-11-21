import { NextRequest, NextResponse } from 'next/server';
import { bustCache } from '@/lib/cache';

function isAuthorized(request: NextRequest): boolean {
    const secret = process.env.CACHE_REFRESH_TOKEN;
    if (!secret) return false;
    const auth = request.headers.get('authorization');
    if (auth === `Bearer ${secret}`) return true;
    const headerToken = request.headers.get('x-cache-token');
    return headerToken === secret;
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key : undefined;
    bustCache(key);
    return NextResponse.json({ ok: true, busted: key ?? 'all' });
}
