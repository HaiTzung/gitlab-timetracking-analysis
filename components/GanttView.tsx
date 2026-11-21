'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Epic, Milestone, Issue } from '@/types/dashboard';
import { parseISO, differenceInDays, format, addDays, endOfMonth, eachMonthOfInterval, startOfWeek, addWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardContext } from '@/context/DashboardContext';

interface GanttViewProps {
    epics: Epic[];
    milestones: Milestone[];
    issues: Issue[];
    globalStart: Date;
    globalEnd: Date;
    stateFilter: 'opened' | 'closed' | 'all';
    assigneeFilter: string;
    pxPerDay: number;
    ganttStateFilter: 'opened' | 'closed' | 'all';
    issueStatuses: Map<string, string>;
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
    assignees?: string[];
    healthStatus?: string | null;
    isOverdue?: boolean;
    progress?: number;
    timeSpent?: number;
    timeEstimate?: number;
    issueStatus?: string;
}

// Depth-indexed palette for epic bars: depth 0 → deepest blue, deeper → lighter
const EPIC_BAR_COLORS = [
    'bg-blue-700 hover:bg-blue-800',
    'bg-blue-500 hover:bg-blue-600',
    'bg-blue-400 hover:bg-blue-500',
    'bg-sky-400 hover:bg-sky-500',
    'bg-sky-300 hover:bg-sky-400',
];
const EPIC_LABEL_COLORS = [
    'font-semibold text-blue-900 dark:text-blue-100',
    'font-semibold text-blue-800 dark:text-blue-200',
    'font-medium text-blue-700 dark:text-blue-300',
    'font-medium text-sky-700 dark:text-sky-300',
    'text-sky-600 dark:text-sky-400',
];

function barColorClass(kind: RowKind, state: string, depth: number): string {
    if (kind === 'epic') return EPIC_BAR_COLORS[Math.min(depth, EPIC_BAR_COLORS.length - 1)];
    if (kind === 'milestone') return 'bg-purple-500 hover:bg-purple-600';
    if (state === 'closed') return 'bg-gray-400 hover:bg-gray-500';
    return 'bg-green-500 hover:bg-green-600';
}

function labelColorClass(kind: RowKind, depth: number): string {
    if (kind === 'epic') return EPIC_LABEL_COLORS[Math.min(depth, EPIC_LABEL_COLORS.length - 1)];
    if (kind === 'milestone') return 'font-semibold text-purple-700 dark:text-purple-300';
    return 'text-gray-600 dark:text-gray-300 text-sm';
}

const GanttView: React.FC<GanttViewProps> = ({
    epics,
    milestones,
    issues,
    globalStart,
    globalEnd,
    stateFilter,
    assigneeFilter,
    pxPerDay,
    ganttStateFilter,
    issueStatuses,
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
            if (ganttStateFilter !== 'all' && i.state !== ganttStateFilter) return false;
            if (assigneeFilter !== 'all' && !i.assignees?.nodes?.some(a => a.name === assigneeFilter)) return false;
            return true;
        }),
    [issues, ganttStateFilter, assigneeFilter]);

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

    // Determine timeline bounds — all dates normalized to midnight
    const timelineStart = useMemo(() => {
        const dates: Date[] = [globalStart];
        epics.forEach(e => { if (e.startDate) dates.push(parseISO(e.startDate)); });
        milestones.forEach(m => { if (m.startDate) dates.push(parseISO(m.startDate)); });
        filteredIssues.forEach(i => {
            const d = parseISO(i.createdAt);
            d.setHours(0, 0, 0, 0);
            dates.push(d);
        });
        const min = dates.reduce((a, b) => a < b ? a : b);
        min.setHours(0, 0, 0, 0);
        return min;
    }, [epics, milestones, filteredIssues, globalStart]);

    const timelineEnd = useMemo(() => {
        const dates: Date[] = [globalEnd];
        // Always include today so the chart never ends before the present
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        dates.push(todayMidnight);
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
        const max = dates.reduce((a, b) => a > b ? a : b);
        // Add a 7-day right-side padding so the last bar never sits flush at the edge
        return addDays(max, 7);
    }, [epics, milestones, filteredIssues, issueToEpicDue, globalEnd]);

    const totalDays = Math.max(1, differenceInDays(timelineEnd, timelineStart));

    const ctx = useDashboardContext();
    const tuOffset = ctx?.tuOffset ?? true;

    const PX_PER_DAY = pxPerDay;
    const timelineWidth = totalDays * PX_PER_DAY;

    // Week markers — pixel-based, respecting tuOffset
    const weeks = useMemo(() => {
        // Find the first week boundary at or before timelineStart
        const monAnchor = startOfWeek(timelineStart, { weekStartsOn: 1 });
        const firstWeekStart = tuOffset ? addDays(monAnchor, 1) : monAnchor;
        // If that pushed us past timelineStart, step back one week
        const start = firstWeekStart > timelineStart ? addDays(firstWeekStart, -7) : firstWeekStart;
        const result: { offsetPx: number; label: string; weekStart: Date }[] = [];
        let w = start;
        while (w <= timelineEnd) {
            if (w >= timelineStart) {
                const offsetPx = differenceInDays(w, timelineStart) * PX_PER_DAY;
                // KW number is always based on Monday, so use Mon anchor for label
                const monForLabel = tuOffset ? addDays(w, -1) : w;
                result.push({ offsetPx, label: format(monForLabel, "'KW' II", { locale: de }), weekStart: w });
            }
            w = addWeeks(w, 1);
        }
        return result;
    }, [timelineStart, timelineEnd, tuOffset, pxPerDay]);

    // Month headers — pixel-based
    const months = useMemo(() => {
        return eachMonthOfInterval({ start: timelineStart, end: timelineEnd }).map(m => {
            const start = m < timelineStart ? timelineStart : m;
            const end = endOfMonth(m) > timelineEnd ? timelineEnd : endOfMonth(m);
            const days = differenceInDays(end, start) + 1;
            const offsetPx = differenceInDays(start, timelineStart) * PX_PER_DAY;
            const widthPx = days * PX_PER_DAY;
            return { label: format(m, 'MMM yyyy', { locale: de }), offsetPx, widthPx };
        });
    }, [timelineStart, timelineEnd, pxPerDay]);

    // Today marker — strip time so differenceInDays compares midnight-to-midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPx = Math.max(0, differenceInDays(today, timelineStart)) * PX_PER_DAY;
    const showToday = today >= timelineStart && today <= timelineEnd;

    const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set());

    // Build rows recursively
    function epicHasContent(epicIid: string): boolean {
        if ((epicIssues.get(epicIid)?.length ?? 0) > 0) return true;
        return (childEpics.get(epicIid) ?? []).some(c => epicHasContent(c.iid));
    }

    function issueRow(issue: Issue, depth: number): GanttRow {
        // Normalize to midnight so differenceInDays is consistent with date-only epic/milestone dates
        const barStart = parseISO(issue.createdAt);
        barStart.setHours(0, 0, 0, 0);
        let barEnd: Date;
        if (issue.state === 'closed' && issue.closedAt) {
            barEnd = parseISO(issue.closedAt);
            barEnd.setHours(0, 0, 0, 0);
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
            assignees: issue.assignees?.nodes?.map(a => a.name) ?? [],
            healthStatus: issue.healthStatus ?? null,
        isOverdue: issue.state === 'opened' && barEnd < new Date(new Date().setHours(0, 0, 0, 0)),
        progress: issue.timeEstimate > 0 ? Math.min(1, issue.totalTimeSpent / issue.timeEstimate) : undefined,
        timeSpent: issue.totalTimeSpent,
        timeEstimate: issue.timeEstimate > 0 ? issue.timeEstimate : undefined,
        issueStatus: issueStatuses.get(issue.iid),
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
        // If collapsed, skip all children and issues
        if (!collapsedEpics.has(epic.iid)) {
            // Child epics
            const children = (childEpics.get(epic.iid) ?? [])
                .filter(c => epicHasContent(c.iid))
                .slice().sort((a, b) => {
                if (!a.startDate && !b.startDate) return 0;
                if (!a.startDate) return 1;
                if (!b.startDate) return -1;
                return a.startDate.localeCompare(b.startDate);
            });
            children.forEach(child => rows.push(...epicRows(child, depth + 1)));
            // Issues for this epic — sorted by IID ascending
            (epicIssues.get(epic.iid) ?? [])
                .slice().sort((a, b) => Number(a.iid) - Number(b.iid))
                .forEach(issue => rows.push(issueRow(issue, depth + 1)));
        }
        return rows;
    }

    const rows = useMemo(() => {
        const result: GanttRow[] = [];
        // Epics + their issues (skip empty epics)
        rootEpics.filter(e => epicHasContent(e.iid)).forEach(epic => result.push(...epicRows(epic, 0)));
        // Milestones + their associated issues (skip empty milestones)
        const sortedMilestones = [...milestones]
            .filter(ms => (milestoneIssues.get(ms.title)?.length ?? 0) > 0)
            .sort((a, b) => {
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
    }, [rootEpics, milestones, epicIssues, milestoneIssues, orphanIssues, globalStart, globalEnd, issueToEpicDue, collapsedEpics]);

    if (rows.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                Keine Daten für das Gantt-Diagramm vorhanden.
            </div>
        );
    }

    const ROW_HEIGHT = 64;
    const MONTH_HEADER_HEIGHT = 32;
    const WEEK_HEADER_HEIGHT = 36;
    const HEADER_HEIGHT = MONTH_HEADER_HEIGHT + WEEK_HEADER_HEIGHT;
    const LABEL_WIDTH = 240;

    const [tooltip, setTooltip] = useState<{ lines: string[]; x: number; y: number } | null>(null);

    function rowTipLines(row: GanttRow, includeDates: boolean): string[] {
        const lines: string[] = [row.title];
        if (includeDates) lines.push(`${format(row.barStart, 'dd.MM.yyyy')} – ${format(row.barEnd, 'dd.MM.yyyy')}`);
        if (row.kind === 'issue' && (row.timeSpent !== undefined || row.timeEstimate !== undefined)) {
            const fmt = (s: number) => {
                const h = Math.floor(s / 3600);
                const m = Math.floor((s % 3600) / 60);
                return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
            };
            const spent = row.timeSpent ? fmt(row.timeSpent) : '0h';
            const estimate = row.timeEstimate ? fmt(row.timeEstimate) : null;
            lines.push(estimate ? `⏱ ${spent} / ${estimate}` : `⏱ ${spent}`);
        }
        if (row.issueStatus) lines.push(`◈ ${row.issueStatus}`);
        if (row.assignees?.length) lines.push(`👤 ${row.assignees.join(', ')}`);
        if (row.healthStatus) {
            const label = row.healthStatus === 'on_track' ? '🟢 On track'
                : row.healthStatus === 'needs_attention' ? '🟡 Needs attention'
                : row.healthStatus === 'at_risk' ? '🔴 At risk'
                : row.healthStatus;
            lines.push(label);
        }
        return lines;
    }

    const showTip = useCallback((lines: string[], e: React.MouseEvent) => {
        setTooltip({ lines, x: e.clientX, y: e.clientY });
    }, []);
    const moveTip = useCallback((e: React.MouseEvent) => {
        setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null);
    }, []);
    const hideTip = useCallback(() => setTooltip(null), []);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!scrollRef.current || !showToday) return;
        const el = scrollRef.current;
        // Center today in the visible area, with a small left margin so context before today is visible
        const target = todayPx - el.clientWidth * 0.35;
        el.scrollLeft = Math.max(0, target);
    // Only run on mount and when pxPerDay changes (zoom resets the scroll position to keep today centered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pxPerDay]);

    const [scrub, setScrub] = useState<{ x: number; y: number } | null>(null);
    const scrubberRef = useRef<HTMLDivElement>(null);

    const scrubDate = scrub !== null
        ? addDays(timelineStart, Math.floor(scrub.x / PX_PER_DAY))
        : null;

    // Convert bar dates to pixel offsets.
    // Width uses +1 so a bar from day N to day N spans 1 day, not 0.
    function barPx(barStart: Date, barEnd: Date): React.CSSProperties {
        const left = Math.max(0, differenceInDays(barStart, timelineStart)) * PX_PER_DAY;
        const width = Math.max(PX_PER_DAY, (differenceInDays(barEnd, barStart) + 1) * PX_PER_DAY);
        return { left, width };
    }

    return (
        <>
        <div className="flex" style={{ minWidth: 0 }}>
            {/* Sticky label column */}
            <div
                className="flex-shrink-0 z-30 bg-white dark:bg-gray-900"
                style={{ width: LABEL_WIDTH, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}
            >
                {/* Header */}
                <div
                    className="flex items-center px-3 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                    style={{ height: HEADER_HEIGHT }}
                >
                    Titel
                </div>
                {/* Label rows */}
                {rows.map((row, idx) => (
                    <div
                        key={`label-${row.kind}-${row.id}-${idx}`}
                        className="flex items-center border-b border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        style={{ height: ROW_HEIGHT, paddingLeft: `${12 + row.depth * 16}px`, paddingRight: 12 }}
                    >
                        {row.kind === 'epic' && (
                            <button
                                onClick={() => setCollapsedEpics(s => {
                                    const n = new Set(s);
                                    n.has(row.id) ? n.delete(row.id) : n.add(row.id);
                                    return n;
                                })}
                                className="mr-1.5 flex-shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors text-[10px] w-3 text-center leading-none"
                                title={collapsedEpics.has(row.id) ? 'Ausklappen' : 'Einklappen'}
                            >
                                {collapsedEpics.has(row.id) ? '▶' : '▼'}
                            </button>
                        )}
                        {row.kind === 'milestone' && <span className="mr-1.5 text-purple-400 flex-shrink-0">▲</span>}
                        {row.kind === 'issue' && <span className="mr-1.5 text-gray-300 dark:text-gray-600 flex-shrink-0 text-sm">•</span>}
                        <a
                            href={row.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseEnter={e => showTip(rowTipLines(row, false), e)}
                            onMouseMove={moveTip}
                            onMouseLeave={hideTip}
                            className={`truncate hover:underline ${labelColorClass(row.kind, row.depth)}`}
                        >
                            {row.title}
                        </a>
                        {row.kind === 'issue' && row.issueStatus?.toLowerCase().includes('in progress') && (
                            <span className="ml-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" title="In Bearbeitung" />
                        )}
                        {row.isOverdue && (
                            <svg className="ml-1.5 flex-shrink-0 animate-pulse" width="15" height="15" viewBox="0 0 14 14" fill="none" aria-label="Überfällig">
                                <circle cx="7" cy="7" r="6.5" fill="#ef4444" stroke="white" strokeWidth="1" />
                                <rect x="6.1" y="3.2" width="1.8" height="4.4" rx="0.9" fill="white" />
                                <circle cx="7" cy="10.2" r="1" fill="white" />
                            </svg>
                        )}
                    </div>
                ))}
                {/* Footer spacer — always present so label column height matches timeline */}
                <div style={{ height: 28 }} className="border-t border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" />
            </div>

            {/* Scrollable timeline */}
            <div ref={scrollRef} className="overflow-x-auto flex-1">
                <div
                    ref={scrubberRef}
                    style={{ width: timelineWidth, minWidth: timelineWidth, position: 'relative' }}
                    onMouseMove={e => {
                        const rect = scrubberRef.current?.getBoundingClientRect();
                        if (rect) setScrub({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }}
                    onMouseLeave={() => setScrub(null)}
                >
                    {/* Scrubber hairline */}
                    {scrub !== null && scrubDate && (
                        <div
                            className="absolute top-0 bottom-0 w-px bg-blue-400 dark:bg-blue-500 pointer-events-none z-40"
                            style={{ left: scrub.x }}
                        >
                            <div
                                className="absolute bg-blue-500 dark:bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm"
                                style={{
                                    top: scrub.y - 10,
                                    left: scrub.x > timelineWidth - 80 ? 'auto' : 6,
                                    right: scrub.x > timelineWidth - 80 ? 6 : 'auto',
                                    transform: 'translateY(-50%)',
                                }}
                            >
                                {format(scrubDate, 'EEE, dd.MM.yyyy', { locale: de })}
                            </div>
                        </div>
                    )}
                    {/* Month header */}
                    <div
                        className="relative border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                        style={{ height: MONTH_HEADER_HEIGHT, width: timelineWidth }}
                    >
                        {months.map(m => (
                            <div
                                key={m.label}
                                className="absolute top-0 bottom-0 flex items-center px-2 text-xs font-semibold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
                                style={{ left: m.offsetPx, width: m.widthPx }}
                            >
                                {m.label}
                            </div>
                        ))}
                        {showToday && (
                            <div
                                className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                                style={{ left: todayPx }}
                            />
                        )}
                    </div>

                    {/* Week header */}
                    <div
                        className="relative border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
                        style={{ height: WEEK_HEADER_HEIGHT, width: timelineWidth }}
                    >
                        {weeks.map(w => (
                            <div
                                key={w.offsetPx}
                                className="absolute top-0 bottom-0 flex flex-col justify-center px-1.5 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
                                style={{ left: w.offsetPx, width: 7 * PX_PER_DAY }}
                            >
                                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 leading-tight whitespace-nowrap">{w.label}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight whitespace-nowrap">{format(w.weekStart, 'dd.MM.', { locale: de })}</span>
                            </div>
                        ))}
                        {showToday && (
                            <div
                                className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                                style={{ left: todayPx }}
                            />
                        )}
                    </div>

                    {/* Bar rows */}
                    {rows.map((row, idx) => (
                        <div
                            key={`bar-${row.kind}-${row.id}-${idx}`}
                            className="relative border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                            style={{ height: ROW_HEIGHT, width: timelineWidth }}
                        >
                            {/* Month dividers */}
                            {months.map(m => (
                                <div
                                    key={m.label}
                                    className="absolute top-0 bottom-0 border-r border-gray-200 dark:border-gray-600"
                                    style={{ left: m.offsetPx, width: m.widthPx }}
                                />
                            ))}
                            {/* Week dividers */}
                            {weeks.map(w => (
                                <div
                                    key={w.offsetPx}
                                    className="absolute top-0 bottom-0 border-r border-gray-100 dark:border-gray-700/60"
                                    style={{ left: w.offsetPx, width: 7 * PX_PER_DAY }}
                                />
                            ))}
                            {/* Today marker */}
                            {showToday && (
                                <div
                                    className="absolute top-0 bottom-0 w-px bg-red-300 dark:bg-red-600 z-10"
                                    style={{ left: todayPx }}
                                />
                            )}
                            {/* Gantt bar */}
                            <a
                                href={row.webUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onMouseEnter={e => showTip(rowTipLines(row, true), e)}
                                onMouseMove={moveTip}
                                onMouseLeave={hideTip}
                                className={`absolute top-1/2 -translate-y-1/2 h-8 rounded flex items-center px-2 overflow-hidden transition-colors z-20 ${barColorClass(row.kind, row.state, row.depth)}`}
                                style={barPx(row.barStart, row.barEnd)}
                            >
                                {/* Progress fill */}
                                {row.progress !== undefined && (
                                    <div
                                        className="absolute top-0 left-0 bottom-0 bg-white/25 pointer-events-none"
                                        style={{ width: `${row.progress * 100}%` }}
                                    />
                                )}
                                <span className="relative text-white text-xs truncate leading-tight select-none z-10 flex-1 min-w-0">
                                    {row.title}
                                </span>
                                {/* Overdue exclamation mark */}
                                {row.isOverdue && (
                                    <svg className="flex-shrink-0 ml-1.5 animate-pulse z-10" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Überfällig">
                                        <circle cx="7" cy="7" r="6.5" fill="#ef4444" stroke="white" strokeWidth="1.2" />
                                        <rect x="6.1" y="3.2" width="1.8" height="4.4" rx="0.9" fill="white" />
                                        <circle cx="7" cy="10.2" r="1" fill="white" />
                                    </svg>
                                )}
                            </a>
                        </div>
                    ))}

                    {/* Footer: today label — always rendered so it closes the chart cleanly */}
                    <div className="relative border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" style={{ height: 28, width: timelineWidth }}>
                        {showToday && (
                            <>
                                <div className="absolute top-0 bottom-0 w-px bg-red-400" style={{ left: todayPx }} />
                                <div
                                    className="absolute text-xs text-red-400 font-medium top-1/2 -translate-y-1/2"
                                    style={{ left: todayPx + 4 }}
                                >
                                    Heute
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {tooltip && (
            <div
                className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-md shadow-lg bg-gray-900 dark:bg-gray-700 text-white text-xs leading-snug max-w-xs"
                style={{ left: tooltip.x + 12, top: tooltip.y - 32, transform: 'translateY(-100%)' }}
            >
                {tooltip.lines.map((line, i) => (
                    <div key={i} className={i > 0 ? 'text-gray-300 mt-0.5' : ''}>{line}</div>
                ))}
            </div>
        )}
        </>
    );
};

export default GanttView;
