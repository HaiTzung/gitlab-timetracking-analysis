import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'dashboard_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
    const { password } = await request.json();
    const expected = process.env.ACCESS_PASSWORD;

    if (!expected) {
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    if (password !== expected) {
        return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, 'true', {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
    });
    return response;
}
