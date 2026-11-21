import { NextResponse } from 'next/server';
import { getCacheMetadata } from '@/lib/cache';

export async function GET() {
    const entries = getCacheMetadata();
    return NextResponse.json({ entries });
}
