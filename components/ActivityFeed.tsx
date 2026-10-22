'use client';

import React, { useState, useMemo } from 'react';
import { startOfDay, subDays, format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Issue, Timelog } from '@/types/dashboard';
import { TimeWindow } from '@/context/DashboardContext';

type EventType = 'timelog' | 'issue_opened' | 'issue_closed' | 'comment';

interface ActivityEvent {
    type: EventType;
    timestamp: string;
    actor: string;
    issueIid: string | null;
    issueTitle: string | null;
    issueUrl: string | null;
    hours?: number;
    commentBody?: string;
    commentUrl?: string;
}

interface ActivityFeedProps {
    timelogs: Timelog[];
    issues: Issue[];
    timeWindow: TimeWindow;
    customStart: Date | null;
    customEnd: Date | null;
    usernameToName: Record<string, string>;
}

const TYPE_LABELS: Record<EventType, string> = {
    timelog: 'Zeitbuchung',
    issue_opened: 'Issue geöffnet',
    issue_closed: 'Issue geschlossen',
    comment: 'Kommentar',
};

const TYPE_COLORS: Record<EventType, string> = {
    timelog: 'text-blue-600',
    issue_opened: 'text-green-600',
    issue_closed: 'text-purple-600',
    comment: 'text-gray-500',
};

const TYPE_BG: Record<EventType, string> = {
    timelog: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    issue_opened: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    issue_closed: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
    comment: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300',
};

function ClockIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function OpenIssueIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2.5" fill="currentColor" />
        </svg>
    );
}

function ClosedIssueIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function CommentIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v6A1.5 1.5 0 0112.5 11H9l-3 3v-3H3.5A1.5 1.5 0 012 9.5v-6z"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    );
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            className={`shrink-0 transition-transform duration-200 text-gray-900 dark:text-gray-100 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
        >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function EventIcon({ type }: { type: EventType }) {
    const cls = TYPE_COLORS[type];
    return (
        <span className={cls}>
            {type === 'timelog' && <ClockIcon />}
            {type === 'issue_opened' && <OpenIssueIcon />}
            {type === 'issue_closed' && <ClosedIssueIcon />}
            {type === 'comment' && <CommentIcon />}
        </span>
    );
}

function getWindowBounds(
    timeWindow: TimeWindow,
    localWindow: 'today' | '7d',
    customStart: Date | null,
    customEnd: Date | null,
): { from: Date; to: Date } {
    const now = new Date();
    if (timeWindow === 'all') {
        return localWindow === 'today'
            ? { from: startOfDay(now), to: now }
            : { from: subDays(now, 7), to: now };
    }
    const to = timeWindow === 'custom' && customEnd ? customEnd : now;
    const from =
        timeWindow === '7d' ? subDays(now, 7)
        : timeWindow === '14d' ? subDays(now, 14)
        : timeWindow === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1)
        : timeWindow === 'custom' && customStart ? customStart
        : subDays(now, 7);
    return { from, to };
}

function inWindow(dateStr: string | null | undefined, from: Date, to: Date): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= from && d <= to;
}

function timeAgo(isoDate: string): string {
    return formatDistanceToNow(new Date(isoDate), { addSuffix: true, locale: de });
}

function formatDate(isoDate: string): string {
    return format(new Date(isoDate), 'dd.MM.yyyy HH:mm', { locale: de });
}

export default function ActivityFeed({ timelogs, issues, timeWindow, customStart, customEnd, usernameToName }: ActivityFeedProps) {
    const [open, setOpen] = useState(false);
    const [localWindow, setLocalWindow] = useState<'today' | '7d'>('today');
    const [typeFilter, setTypeFilter] = useState<Set<EventType>>(
        new Set(['timelog', 'issue_opened', 'issue_closed', 'comment'])
    );

    const { from, to } = useMemo(
        () => getWindowBounds(timeWindow, localWindow, customStart, customEnd),
        [timeWindow, localWindow, customStart, customEnd]
    );

    const events = useMemo((): ActivityEvent[] => {
        const result: ActivityEvent[] = [];

        for (const log of timelogs) {
            if (!inWindow(log.spentAt, from, to)) continue;
            result.push({
                type: 'timelog',
                timestamp: log.spentAt,
                actor: log.user.name,
                issueIid: log.issue?.iid ?? null,
                issueTitle: log.issue?.title ?? null,
                issueUrl: null, // timelogs don't carry webUrl; resolved below
                hours: parseFloat((log.timeSpent / 3600).toFixed(2)),
            });
        }

        // Build issue URL lookup from the issues array
        const issueUrlMap: Record<string, string> = {};
        for (const issue of issues) {
            issueUrlMap[issue.iid] = issue.webUrl;
        }

        // Patch timelog issue URLs
        for (const ev of result) {
            if (ev.type === 'timelog' && ev.issueIid) {
                ev.issueUrl = issueUrlMap[ev.issueIid] ?? null;
            }
        }

        for (const issue of issues) {
            if (inWindow(issue.createdAt, from, to)) {
                const username = issue.author?.username ?? '';
                result.push({
                    type: 'issue_opened',
                    timestamp: issue.createdAt,
                    actor: usernameToName[username] ?? username,
                    issueIid: issue.iid,
                    issueTitle: issue.title,
                    issueUrl: issue.webUrl,
                });
            }
            if (issue.closedAt && inWindow(issue.closedAt, from, to)) {
                result.push({
                    type: 'issue_closed',
                    timestamp: issue.closedAt,
                    actor: '',
                    issueIid: issue.iid,
                    issueTitle: issue.title,
                    issueUrl: issue.webUrl,
                });
            }
            for (const note of issue.notes?.nodes ?? []) {
                if (!inWindow(note.createdAt, from, to)) continue;
                result.push({
                    type: 'comment',
                    timestamp: note.createdAt,
                    actor: note.author.name,
                    issueIid: issue.iid,
                    issueTitle: issue.title,
                    issueUrl: issue.webUrl,
                    commentBody: note.body,
                    commentUrl: note.url,
                });
            }
        }

        return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }, [timelogs, issues, from, to]);

    const filtered = useMemo(
        () => events.filter(e => typeFilter.has(e.type)),
        [events, typeFilter]
    );

    function toggleType(type: EventType) {
        setTypeFilter(prev => {
            const next = new Set(prev);
            if (next.has(type)) {
                if (next.size > 1) next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    }

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Collapsible header */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Aktivitätsverlauf
                    {open && filtered.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                            {filtered.length} {filtered.length === 1 ? 'Eintrag' : 'Einträge'}
                        </span>
                    )}
                </span>
                <ChevronIcon open={open} />
            </button>

            {open && (
                <div className="p-4 space-y-3">
                    {/* Controls row */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Type filter chips */}
                        {(Object.keys(TYPE_LABELS) as EventType[]).map(type => {
                            const active = typeFilter.has(type);
                            return (
                                <button
                                    key={type}
                                    onClick={() => toggleType(type)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                        active
                                            ? TYPE_BG[type]
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <span className={active ? TYPE_COLORS[type] : 'text-gray-300 dark:text-gray-600'}>
                                        {type === 'timelog' && <ClockIcon />}
                                        {type === 'issue_opened' && <OpenIssueIcon />}
                                        {type === 'issue_closed' && <ClosedIssueIcon />}
                                        {type === 'comment' && <CommentIcon />}
                                    </span>
                                    {TYPE_LABELS[type]}
                                </button>
                            );
                        })}

                        {/* Local window toggle — only shown when global is 'all' */}
                        {timeWindow === 'all' && (
                            <div className="ml-auto flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                                <button
                                    onClick={() => setLocalWindow('today')}
                                    className={`px-3 py-1 transition-colors ${
                                        localWindow === 'today'
                                            ? 'bg-gray-800 dark:bg-gray-600 text-white'
                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    Heute
                                </button>
                                <button
                                    onClick={() => setLocalWindow('7d')}
                                    className={`px-3 py-1 border-l border-gray-200 dark:border-gray-700 transition-colors ${
                                        localWindow === '7d'
                                            ? 'bg-gray-800 dark:bg-gray-600 text-white'
                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    Letzte 7 Tage
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Event list */}
                    {filtered.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                            Keine Aktivität im gewählten Zeitraum.
                        </p>
                    ) : (
                        <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 -mx-4 px-4">
                            {filtered.map((ev, i) => (
                                <div key={i} className="py-2.5 flex gap-3">
                                    <div className={`mt-0.5 ${TYPE_COLORS[ev.type]}`}>
                                        <EventIcon type={ev.type} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                            <span className="text-sm text-gray-800 dark:text-gray-100">
                                                {ev.type === 'timelog' && (
                                                    <><strong>{ev.actor}</strong> hat <strong>{ev.hours}h</strong> gebucht</>
                                                )}
                                                {ev.type === 'issue_opened' && (
                                                    ev.actor
                                                        ? <><strong>{ev.actor}</strong> hat ein Issue geöffnet</>
                                                        : <>Issue geöffnet</>
                                                )}
                                                {ev.type === 'issue_closed' && (
                                                    <>Issue geschlossen</>
                                                )}
                                                {ev.type === 'comment' && (
                                                    <><strong>{ev.actor}</strong> hat kommentiert</>
                                                )}
                                            </span>
                                            <time
                                                title={formatDate(ev.timestamp)}
                                                className="text-xs text-gray-400 dark:text-gray-500 shrink-0"
                                            >
                                                {timeAgo(ev.timestamp)}
                                            </time>
                                        </div>

                                        {ev.issueIid && ev.issueTitle && (
                                            <div className="mt-0.5">
                                                {ev.issueUrl ? (
                                                    <a
                                                        href={ev.issueUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:underline"
                                                    >
                                                        #{ev.issueIid} {ev.issueTitle}
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        #{ev.issueIid} {ev.issueTitle}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {ev.type === 'comment' && ev.commentBody && (
                                            <div className="mt-1.5 flex items-start justify-between gap-3">
                                                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 flex-1">
                                                    {ev.commentBody}
                                                </p>
                                                {ev.commentUrl && (
                                                    <a
                                                        href={ev.commentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:underline shrink-0"
                                                    >
                                                        Antworten
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
