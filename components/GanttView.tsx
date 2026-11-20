'use client';

import React, { useMemo } from 'react';
import { Epic, Milestone, Issue } from '@/types/dashboard';
import { parseISO, differenceInDays, format, addDays, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';

interface GanttViewProps {
    epics: Epic[];
    milestones: Milestone[];
    issues: Issue[];
    globalStart: Date;
    globalEnd: Date;
    stateFilter: 'opened' | 'closed' | 'all';
    assigneeFilter: string;
}

type RowKind = 'epic' | 'milestone' | 'issue';

interface GanttRow {
    kind: RowKind;
    id: string;
    title: string;
    webUrl: string;
    barStart: Date;
    barEnd: Date;
    state: string;
    depth: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function barStyle(barStart: Date, barEnd: Date, timelineStart: Date, totalDays: number) {
    const startOffset = differenceInDays(barStart, timelineStart);
    const duration = Math.max(1, differenceInDays(barEnd, barStart));
    const leftPct = clamp((startOffset / totalDays) * 100, 0, 100);
    const widthPct = clamp((duration / totalDays) * 100, 0, 100 - leftPct);
    return { left: `${leftPct}%`, width: `max(4px, ${widthPct}%)` };
}

function barColorClass(kind: RowKind, state: string): string {
    if (kind === 'epic') return 'bg-blue-500 hover:bg-blue-600';
    if (kind === 'milestone') return 'bg-purple-500 hover:bg-purple-600';
    if (state === 'closed') return 'bg-gray-400 hover:bg-gray-500';
    return 'bg-green-500 hover:bg-green-600';
}

function labelColorClass(kind: RowKind): string {
    if (kind === 'epic') return 'font-semibold text-gray-800 dark:text-gray-100';
    if (kind === 'milestone') return 'font-semibold text-purple-700 dark:text-purple-300';
    return 'text-gray-600 dark:text-gray-300 text-xs';
}

const GanttView: React.FC<GanttViewProps> = ({
    epics,
    milestones,
    issues,
    globalStart,
    globalEnd,
    stateFilter,
    assigneeFilter,
}) => {
    // Build epic lookup maps
    const epicByIid = useMemo(() => new Map(epics.map(e => [e.iid, e])), [epics]);
    const childEpics = useMemo(() => {
        const m = new Map<string | null, Epic[]>();
        epics.forEach(e => {
            const p = e.parent?.iid ?? null;
            if (!m.has(p)) m.set(p, []);
            m.get(p)!.push(e);
        });
        return m;
    }, [epics]);

    const rootEpics = useMemo(() =>
        (childEpics.get(null) ?? []).slice().sort((a, b) => {
            if (!a.startDate && !b.startDate) return 0;
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return a.startDate.localeCompare(b.startDate);
        }),
    [childEpics]);

    // Filter issues
    const filteredIssues = useMemo(() =>
        issues.filter(i => {
            if (stateFilter !== 'all' && i.state !== stateFilter) return false;
            if (assigneeFilter !== 'all' && !i.assignees?.nodes?.some(a => a.name === assigneeFilter)) return false;
            return true;
        }),
    [issues, stateFilter, assigneeFilter]);

    // Map issue iid -> parent epic dueDate (for open issues)
    const issueToEpicDue = useMemo(() => {
        const m = new Map<string, Date | null>();
        // forward lookup
        filteredIssues.forEach(issue => {
            const epicIid = issue.epic?.iid;
            if (epicIid) {
                const epic = epicByIid.get(epicIid);
                m.set(issue.iid, epic?.dueDate ? parseISO(epic.dueDate) : null);
            }
        });
        // reverse lookup fallback for unmatched
        const issueByIid = new Map(filteredIssues.map(i => [i.iid, i]));
        epics.forEach(epic => {
            epic.issues?.nodes?.forEach(node => {
                if (!m.has(node.iid)) {
                    const issue = issueByIid.get(node.iid);
                    if (issue) {
                        m.set(issue.iid, epic.dueDate ? parseISO(epic.dueDate) : null);
                    }
                }
            });
        });
        return m;
    }, [filteredIssues, epics, epicByIid]);

    // Issues grouped by epic iid
    const epicIssues = useMemo(() => {
        const m = new Map<string, Issue[]>();
        const issueByIid = new Map(filteredIssues.map(i => [i.iid, i]));
        const matched = new Set<string>();
        filteredIssues.forEach(issue => {
            const epicIid = issue.epic?.iid;
            if (!epicIid) return;
            if (!m.has(epicIid)) m.set(epicIid, []);
            m.get(epicIid)!.push(issue);
            matched.add(issue.iid);
        });
        epics.forEach(epic => {
            epic.issues?.nodes?.forEach(node => {
                if (matched.has(node.iid)) return;
                const issue = issueByIid.get(node.iid);
                if (!issue) return;
                if (!m.has(epic.iid)) m.set(epic.iid, []);
                m.get(epic.iid)!.push(issue);
            });
        });
        return m;
    }, [filteredIssues, epics]);

    // Issues grouped by milestone title (issues with no epic)
    const epicAssignedIids = useMemo(() => {
        const s = new Set<string>();
        epicIssues.forEach(list => list.forEach(i => s.add(i.iid)));
        return s;
    }, [epicIssues]);

    const milestoneIssues = useMemo(() => {
        const m = new Map<string, Issue[]>(); // key = milestone.title
        filteredIssues.forEach(issue => {
            if (epicAssignedIids.has(issue.iid)) return;
            const title = issue.milestone?.title;
            if (!title) return;
            if (!m.has(title)) m.set(title, []);
            m.get(title)!.push(issue);
        });
        return m;
    }, [filteredIssues, epicAssignedIids]);

    const orphanIssues = useMemo(() =>
        filteredIssues.filter(i => !epicAssignedIids.has(i.iid) && !i.milestone?.title),
    [filteredIssues, epicAssignedIids]);

    // Determine timeline bounds
    const timelineStart = useMemo(() => {
        const dates: Date[] = [globalStart];
        epics.forEach(e => { if (e.startDate) dates.push(parseISO(e.startDate)); });
        milestones.forEach(m => { if (m.startDate) dates.push(parseISO(m.startDate)); });
        filteredIssues.forEach(i => dates.push(parseISO(i.createdAt)));
        return dates.reduce((a, b) => a < b ? a : b);
    }, [epics, milestones, filteredIssues, globalStart]);

    const timelineEnd = useMemo(() => {
        const dates: Date[] = [globalEnd];
        epics.forEach(e => { if (e.dueDate) dates.push(parseISO(e.dueDate)); });
        milestones.forEach(m => { if (m.dueDate) dates.push(parseISO(m.dueDate)); });
        filteredIssues.forEach(i => {
            if (i.state === 'closed' && i.closedAt) dates.push(parseISO(i.closedAt));
            else if (i.state === 'opened') {
                const epicDue = issueToEpicDue.get(i.iid);
                if (epicDue) dates.push(epicDue);
                else dates.push(globalEnd);
            }
        });
        return dates.reduce((a, b) => a > b ? a : b);
    }, [epics, milestones, filteredIssues, issueToEpicDue, globalEnd]);

    const totalDays = Math.max(1, differenceInDays(timelineEnd, timelineStart));

    // Month headers
    const months = useMemo(() => {
        return eachMonthOfInterval({ start: timelineStart, end: timelineEnd }).map(m => {
            const start = m < timelineStart ? timelineStart : m;
            const end = endOfMonth(m) > timelineEnd ? timelineEnd : endOfMonth(m);
            const days = differenceInDays(end, start) + 1;
            const widthPct = (days / totalDays) * 100;
            const offsetPct = (differenceInDays(start, timelineStart) / totalDays) * 100;
            return {
                label: format(m, 'MMM yyyy', { locale: de }),
                widthPct,
                offsetPct,
            };
        });
    }, [timelineStart, timelineEnd, totalDays]);

    // Today marker
    const today = new Date();
    const todayOffset = differenceInDays(today, timelineStart);
    const todayPct = clamp((todayOffset / totalDays) * 100, 0, 100);
    const showToday = today >= timelineStart && today <= timelineEnd;

    // Build rows recursively
    function issueRow(issue: Issue, depth: number): GanttRow {
        const barStart = parseISO(issue.createdAt);
        let barEnd: Date;
        if (issue.state === 'closed' && issue.closedAt) {
            barEnd = parseISO(issue.closedAt);
        } else {
            barEnd = issueToEpicDue.get(issue.iid) ?? globalEnd;
        }
        if (barEnd <= barStart) barEnd = addDays(barStart, 1);
        return {
            kind: 'issue',
            id: issue.iid,
            title: `#${issue.iid} ${issue.title}`,
            webUrl: issue.webUrl,
            barStart,
            barEnd,
            state: issue.state,
            depth,
        };
    }

    function epicRows(epic: Epic, depth: number): GanttRow[] {
        const rows: GanttRow[] = [];
        const barStart = epic.startDate ? parseISO(epic.startDate) : globalStart;
        const barEnd = epic.dueDate ? parseISO(epic.dueDate) : globalEnd;
        rows.push({
            kind: 'epic',
            id: epic.iid,
            title: epic.title,
            webUrl: epic.webUrl,
            barStart,
            barEnd: barEnd > barStart ? barEnd : addDays(barStart, 1),
            state: epic.state,
            depth,
        });
        // Child epics
        const children = (childEpics.get(epic.iid) ?? []).slice().sort((a, b) => {
            if (!a.startDate && !b.startDate) return 0;
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return a.startDate.localeCompare(b.startDate);
        });
        children.forEach(child => rows.push(...epicRows(child, depth + 1)));
        // Issues for this epic
        (epicIssues.get(epic.iid) ?? []).forEach(issue => rows.push(issueRow(issue, depth + 1)));
        return rows;
    }

    const rows = useMemo(() => {
        const result: GanttRow[] = [];
        // Epics + their issues
        rootEpics.forEach(epic => result.push(...epicRows(epic, 0)));
        // Milestones + their associated issues
        const sortedMilestones = [...milestones].sort((a, b) => {
            if (!a.startDate && !b.startDate) return 0;
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return a.startDate.localeCompare(b.startDate);
        });
        sortedMilestones.forEach(ms => {
            const barStart = ms.startDate ? parseISO(ms.startDate) : globalStart;
            const barEnd = ms.dueDate ? parseISO(ms.dueDate) : globalEnd;
            result.push({
                kind: 'milestone',
                id: ms.iid,
                title: ms.title,
                webUrl: ms.webUrl,
                barStart,
                barEnd: barEnd > barStart ? barEnd : addDays(barStart, 1),
                state: ms.state,
                depth: 0,
            });
            (milestoneIssues.get(ms.title) ?? []).forEach(issue => result.push(issueRow(issue, 1)));
        });
        // Orphan issues
        orphanIssues.forEach(issue => result.push(issueRow(issue, 0)));
        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rootEpics, milestones, epicIssues, milestoneIssues, orphanIssues, globalStart, globalEnd, issueToEpicDue]);

    if (rows.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                Keine Daten für das Gantt-Diagramm vorhanden.
            </div>
        );
    }

    const ROW_HEIGHT = 32;
    const LABEL_WIDTH = 240;

    return (
        <div className="overflow-x-auto">
            <div style={{ minWidth: `${LABEL_WIDTH + 800}px` }}>
                {/* Header row */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div
                        className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700"
                        style={{ width: LABEL_WIDTH }}
                    >
                        Titel
                    </div>
                    <div className="relative flex-1" style={{ height: 32 }}>
                        {months.map(m => (
                            <div
                                key={m.label}
                                className="absolute top-0 bottom-0 flex items-center justify-start px-2 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
                                style={{ left: `${m.offsetPct}%`, width: `${m.widthPct}%` }}
                            >
                                {m.label}
                            </div>
                        ))}
                        {showToday && (
                            <div
                                className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                                style={{ left: `${todayPct}%` }}
                            />
                        )}
                    </div>
                </div>

                {/* Gantt rows */}
                <div>
                    {rows.map((row, idx) => (
                        <div
                            key={`${row.kind}-${row.id}-${idx}`}
                            className="flex items-center border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                            style={{ height: ROW_HEIGHT }}
                        >
                            {/* Label column */}
                            <div
                                className="flex-shrink-0 flex items-center border-r border-gray-200 dark:border-gray-700 overflow-hidden"
                                style={{ width: LABEL_WIDTH, paddingLeft: `${8 + row.depth * 16}px`, paddingRight: 8 }}
                            >
                                {row.kind === 'epic' && (
                                    <span className="mr-1 text-blue-400 flex-shrink-0">◆</span>
                                )}
                                {row.kind === 'milestone' && (
                                    <span className="mr-1 text-purple-400 flex-shrink-0">▲</span>
                                )}
                                {row.kind === 'issue' && (
                                    <span className="mr-1 text-gray-300 dark:text-gray-600 flex-shrink-0 text-xs">•</span>
                                )}
                                <a
                                    href={row.webUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={row.title}
                                    className={`truncate hover:underline ${labelColorClass(row.kind)}`}
                                >
                                    {row.title}
                                </a>
                            </div>

                            {/* Bar column */}
                            <div className="relative flex-1 h-full">
                                {/* Month dividers */}
                                {months.map(m => (
                                    <div
                                        key={m.label}
                                        className="absolute top-0 bottom-0 border-r border-gray-100 dark:border-gray-700"
                                        style={{ left: `${m.offsetPct}%`, width: `${m.widthPct}%` }}
                                    />
                                ))}
                                {/* Today marker */}
                                {showToday && (
                                    <div
                                        className="absolute top-0 bottom-0 w-px bg-red-300 dark:bg-red-600 z-10"
                                        style={{ left: `${todayPct}%` }}
                                    />
                                )}
                                {/* Gantt bar */}
                                <a
                                    href={row.webUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`${row.title}\n${format(row.barStart, 'dd.MM.yyyy')} – ${format(row.barEnd, 'dd.MM.yyyy')}`}
                                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded flex items-center px-1.5 overflow-hidden transition-colors z-20 ${barColorClass(row.kind, row.state)}`}
                                    style={barStyle(row.barStart, row.barEnd, timelineStart, totalDays)}
                                >
                                    <span className="text-white text-xs truncate leading-tight select-none">
                                        {row.title}
                                    </span>
                                </a>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer: today label */}
                {showToday && (
                    <div className="flex border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <div className="flex-shrink-0" style={{ width: LABEL_WIDTH }} />
                        <div className="relative flex-1 h-5">
                            <div
                                className="absolute text-xs text-red-400 font-medium"
                                style={{ left: `${todayPct}%`, transform: 'translateX(-50%)' }}
                            >
                                Heute
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GanttView;
