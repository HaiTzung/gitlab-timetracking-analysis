/**
 * Server-side background cache refresher.
 * Fetches GitLab data directly (no HTTP round-trip) and writes to the cache store.
 * Called both by the scheduled refresh and by webhook-triggered refresh endpoints.
 */

import { setCached, TTL } from '@/lib/cache';
import { TEAM_MEMBERS, GITLAB_CONFIG } from '@/config/dashboardConfig';

const GITLAB_API_URL = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/graphql';
const GITLAB_TOKEN = process.env.GITLAB_TOKEN ?? '';

const startDate = new Date(process.env.NEXT_PUBLIC_START_DATE ?? '2026-09-27');
const endDate   = new Date(process.env.NEXT_PUBLIC_END_DATE   ?? '2027-07-01');

async function gitlabQuery(query: string, variables?: Record<string, unknown>): Promise<any> {
    const res = await fetch(GITLAB_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${GITLAB_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`GitLab API error: ${res.status}`);
    return res.json();
}

export async function refreshIssues(): Promise<void> {
    const GROUP = GITLAB_CONFIG.GROUP_PATH;
    let allNodes: any[] = [];
    let cursor: string | null = null;
    let hasNext = true;

    while (hasNext) {
        const data = await gitlabQuery(`{
            group(fullPath: "${GROUP}") {
                issues(first: 100, after: ${cursor ? `"${cursor}"` : 'null'}) {
                    nodes {
                        title description iid state webUrl createdAt updatedAt closedAt
                        dueDate weight healthStatus
                        milestone { title dueDate }
                        assignees { nodes { name username } }
                        author { username }
                        labels { nodes { title } }
                        timeEstimate totalTimeSpent
                        epic { iid }
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
        }`);

        const issues = data?.data?.group?.issues;
        if (!issues) break;
        if (cursor === null) {
            // Only cache on first page (key covers full result set)
            const fetchedAt = Date.now();
            setCached(`issues:${GROUP}`, data, TTL.ISSUES, fetchedAt);
        }
        allNodes = [...allNodes, ...issues.nodes];
        hasNext = issues.pageInfo.hasNextPage;
        cursor = issues.pageInfo.endCursor;
    }
    // silent success
}

export async function refreshEpics(): Promise<void> {
    const GROUP = GITLAB_CONFIG.GROUP_PATH;
    let cursor: string | null = null;
    let hasNext = true;
    let count = 0;

    while (hasNext) {
        const data = await gitlabQuery(`{
            group(fullPath: "${GROUP}") {
                epics(first: 100, after: ${cursor ? `"${cursor}"` : 'null'}) {
                    nodes {
                        id iid title state webUrl startDate dueDate
                        descendantCounts { openedIssues closedIssues openedEpics closedEpics }
                        parent { iid }
                        issues(first: 100) { nodes { iid } }
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
        }`);

        const epics = data?.data?.group?.epics;
        if (!epics) break;
        if (cursor === null) {
            setCached(`epics:${GROUP}`, data, TTL.EPICS);
        }
        count += epics.nodes.length;
        hasNext = epics.pageInfo.hasNextPage;
        cursor = epics.pageInfo.endCursor;
    }
        // silent success (epics)
}

export async function refreshMilestones(): Promise<void> {
    const GROUP = GITLAB_CONFIG.GROUP_PATH;
    let cursor: string | null = null;
    let hasNext = true;
    let count = 0;

    while (hasNext) {
        const data = await gitlabQuery(`{
            group(fullPath: "${GROUP}") {
                milestones(first: 100, after: ${cursor ? `"${cursor}"` : 'null'}) {
                    nodes { id iid title startDate dueDate webUrl state }
                    pageInfo { hasNextPage endCursor }
                }
            }
        }`);

        const ms = data?.data?.group?.milestones;
        if (!ms) break;
        if (cursor === null) {
            setCached(`milestones:${GROUP}`, data, TTL.MILESTONES);
        }
        count += ms.nodes.length;
        hasNext = ms.pageInfo.hasNextPage;
        cursor = ms.pageInfo.endCursor;
    }
        // silent success (milestones)
}

export async function refreshTimelogs(): Promise<void> {
    const GROUP = GITLAB_CONFIG.GROUP_PATH;
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr   = endDate.toISOString().slice(0, 10);

    // Determine TTL: past-only windows are immutable
    const kwStart = new Date();
    kwStart.setHours(0, 0, 0, 0);
    kwStart.setDate(kwStart.getDate() - (kwStart.getDay() === 0 ? 6 : kwStart.getDay() - 1));
    const isPastOnly = endDate < kwStart;
    const ttl = isPastOnly ? TTL.PAST_TIMELOGS : TTL.CURRENT_TIMELOGS;

    await Promise.all(TEAM_MEMBERS.map(async (username) => {
        let cursor: string | null = null;
        let hasNext = true;
        let count = 0;

        while (hasNext) {
            const data = await gitlabQuery(`{
                group(fullPath: "${GROUP}") {
                    timelogs(
                        first: 100,
                        after: ${cursor ? `"${cursor}"` : 'null'},
                        startDate: "${startDate.toISOString()}",
                        endDate: "${endDate.toISOString()}",
                        username: "${username}"
                    ) {
                        nodes {
                            user { name username }
                            issue {
                                title iid
                                labels { nodes { title } }
                                timeEstimate totalTimeSpent
                            }
                            spentAt timeSpent
                        }
                        pageInfo { hasNextPage endCursor }
                    }
                }
            }`);

            const tl = data?.data?.group?.timelogs;
            if (!tl) break;
            if (cursor === null) {
                setCached(`timelogs:${username}:${startStr}:${endStr}`, data, ttl);
            }
            count += tl.nodes.length;
            hasNext = tl.pageInfo.hasNextPage;
            cursor = tl.pageInfo.endCursor;
        }
        // silent success
    }));
}

export async function refreshAll(): Promise<void> {
    await Promise.all([
        refreshIssues(),
        refreshEpics(),
        refreshMilestones(),
        refreshTimelogs(),
    ]);
}
