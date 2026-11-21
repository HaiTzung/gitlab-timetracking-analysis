import { NextRequest, NextResponse } from 'next/server';
import { bustCache } from '@/lib/cache';

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key : undefined;
    bustCache(key);
    return NextResponse.json({ ok: true, busted: key ?? 'all' });
}
