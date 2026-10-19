import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const token = process.env.GITLAB_TOKEN;
    const apiUrl = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/graphql';

    if (!token) {
        return NextResponse.json({ error: 'GITLAB_TOKEN not configured' }, { status: 500 });
    }

    const body = await request.json();

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
}
