import { NextRequest, NextResponse } from 'next/server';
import { refreshIssues, refreshTimelogs, refreshAll } from '@/lib/cacheRefresher';

const VALID_TYPES = ['issues', 'timelogs', 'all'] as const;
type RefreshType = typeof VALID_TYPES[number];

function isAuthorized(request: NextRequest): boolean {
    const secret = process.env.CACHE_REFRESH_TOKEN;
    if (!secret) return false; // token must be configured

    const auth = request.headers.get('authorization');
    if (auth === `Bearer ${secret}`) return true;

    const headerToken = request.headers.get('x-cache-token');
    if (headerToken === secret) return true;

    return false;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ type: string }> }
) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await params;

    if (!VALID_TYPES.includes(type as RefreshType)) {
        return NextResponse.json(
            { error: `Unknown type "${type}". Valid: ${VALID_TYPES.join(', ')}` },
            { status: 400 }
        );
    }

    const started = Date.now();
    try {
        if (type === 'issues') {
            await refreshIssues();
        } else if (type === 'timelogs') {
            await refreshTimelogs();
        } else {
            await refreshAll();
        }

        return NextResponse.json({
            ok: true,
            type,
            durationMs: Date.now() - started,
            refreshedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error(`[cache/refresh/${type}] error:`, err);
        return NextResponse.json(
            { error: 'Refresh failed', detail: String(err) },
            { status: 500 }
        );
    }
}
