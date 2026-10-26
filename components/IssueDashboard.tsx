'use client';

import React, { useState } from 'react';
import { Issue, Epic, Timelog, ProjectMetrics } from '@/types/dashboard';
import { CATEGORIES, COLORS, DEVIATION_THRESHOLDS, GITLAB_CONFIG } from '@/config/dashboardConfig';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area,
} from 'recharts';
import { format, parseISO, eachWeekOfInterval, addDays, subDays, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardContext } from '@/context/DashboardContext';
import { useChartColors } from '@/hooks/useChartColors';
import { useTheme } from 'next-themes';

const CATEGORY_VALUES_TREND = Object.values(CATEGORIES) as string[];

function buildDailyCategoryData(timelogs: Timelog[], weekStart: Date, weekEnd: Date) {
    const weekLogs = timelogs.filter(t => {
        const d = parseISO(t.spentAt);
        return d >= weekStart && d <= weekEnd;
    });
    return Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        const label = format(day, 'EEE dd.MM.', { locale: de });
        const categoryHours: Record<string, number> = {};
        CATEGORY_VALUES_TREND.forEach(cat => {
            categoryHours[cat] = weekLogs
                .filter(t => {
                    const d = parseISO(t.spentAt);
                    return isSameDay(d, day) && t.issue?.labels?.nodes?.some(l => l.title === cat);
                })
                .reduce((s, t) => s + t.timeSpent / 3600, 0);
        });
        return { day: label, categoryHours };
    });
}

function buildCategoryIssueCount(issues: Issue[]) {
    const CATEGORY_VALUES = Object.values(CATEGORIES) as string[];
    const getMainCategory = (issue: Issue) =>
        issue.labels?.nodes?.find(l => CATEGORY_VALUES.includes(l.title))?.title ?? '';
    return CATEGORY_VALUES.map(cat => {
        const catIssues = issues.filter(i => getMainCategory(i) === cat);
        return {
            category: cat.replace('category::', ''),
            opened: catIssues.filter(i => i.state === 'opened').length,
            closed: catIssues.filter(i => i.state === 'closed').length,
            total: catIssues.length,
        };
    }).filter(c => c.total > 0);
}

function buildCategoryIssueCountForWeek(issues: Issue[], weekStart: Date, weekEnd: Date) {
    const getMainCategory = (issue: Issue) =>
        (Object.values(CATEGORIES) as string[]).find(c => issue.labels?.nodes?.some(l => l.title === c)) ?? '';
    return (Object.values(CATEGORIES) as string[]).map(cat => {
        const catIssues = issues.filter(i => getMainCategory(i) === cat);
        return {
            category: cat.replace('category::', ''),
            opened: catIssues.filter(i => { const d = parseISO(i.createdAt); return d >= weekStart && d <= weekEnd; }).length,
            closed: catIssues.filter(i => { if (!i.closedAt) return false; const d = parseISO(i.closedAt); return d >= weekStart && d <= weekEnd; }).length,
        };
    });
}

function buildWeeklyIssueVolume(issues: Issue[]) {
    if (!issues.length) return [];
    const dates = issues.map(i => parseISO(i.createdAt));
    const earliest = dates.reduce((a, b) => a < b ? a : b);
    const weeks = eachWeekOfInterval({ start: earliest, end: new Date() }, { weekStartsOn: 1 });
    return weeks.map(weekStart => {
        const weekEnd = addDays(weekStart, 6);
        const label = format(weekStart, "'KW' II/yy", { locale: de });
        const opened = issues.filter(i => { const d = parseISO(i.createdAt); return d >= weekStart && d <= weekEnd; }).length;
        const closed = issues.filter(i => { if (!i.closedAt) return false; const d = parseISO(i.closedAt); return d >= weekStart && d <= weekEnd; }).length;
        return { week: label, opened, closed };
    }).filter(w => w.opened > 0 || w.closed > 0);
}

interface IssueDashboardProps {
    issues: Issue[];
    epics: Epic[];
    issueStatuses: Map<string, string>;
    defaultExpanded?: boolean;
    timelogs: Timelog[];
    projectMetrics: ProjectMetrics;
}

type StateFilter = 'opened' | 'closed' | 'all';

const CATEGORY_VALUES = Object.values(CATEGORIES) as string[];

function getMainCategory(issue: Issue): string {
    return issue.labels?.nodes?.find(l => CATEGORY_VALUES.includes(l.title))?.title ?? '';
}

function healthColor(status: string | null) {
    if (status === 'onTrack') return 'bg-green-500';
    if (status === 'needsAttention') return 'bg-yellow-400';
    if (status === 'atRisk') return 'bg-red-500';
    return null;
}

function healthLabel(status: string | null) {
    if (status === 'onTrack') return 'On Track';
    if (status === 'needsAttention') return 'Needs Attention';
    if (status === 'atRisk') return 'At Risk';
    return null;
}

function isOverdue(dateStr: string | null, closed = false): boolean {
    if (!dateStr || closed) return false;
    return new Date(dateStr) < new Date();
}

function fmtDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return format(parseISO(dateStr), 'dd.MM.yy');
}

function deviationBadge(estimated: number, spent: number) {
    if (estimated === 0 && spent === 0) return null;
    const pct = estimated > 0 ? ((spent - estimated) / estimated) * 100 : Infinity;
    const label = estimated === 0
        ? (spent > 0 ? '+∞%' : '0%')
        : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
    const color = estimated === 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        : Math.abs(pct) <= DEVIATION_THRESHOLDS.EXCELLENT ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
        : Math.abs(pct) <= DEVIATION_THRESHOLDS.GOOD ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
        : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
    return <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}

function stateBadge(state: string, statusName?: string) {
    const isInProgress = state === 'opened' &&
        statusName?.toLowerCase().includes('in progress');

    if (state === 'opened' && isInProgress) return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-0.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            In Bearbeitung
        </span>
    );
    if (state === 'opened') return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded px-1.5 py-0.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Offen
        </span>
    );
    if (state === 'closed') return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Geschlossen
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-xs bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 rounded px-1.5 py-0.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            {state}
        </span>
    );
}

function AssigneeChips({ assignees }: { assignees: Issue['assignees'] }) {
    if (!assignees?.nodes?.length) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>;
    return (
        <div className="flex flex-wrap gap-1 justify-end" style={{ maxWidth: '52px' }}>
            {assignees.nodes.map(a => (
                <span key={a.username} title={a.name}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold flex-shrink-0">
                    {a.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </span>
            ))}
        </div>
    );
}

function IssueRow({ issue, depth = 0, issueStatuses }: { issue: Issue; depth?: number; issueStatuses: Map<string, string> }) {
    const estimated = (issue.timeEstimate || 0) / 3600;
    const spent = (issue.totalTimeSpent || 0) / 3600;
    const category = getMainCategory(issue);
    const isClosed = issue.state === 'closed';
    const health = healthColor(issue.healthStatus);
    const hasMetadata = issue.milestone || issue.healthStatus || issue.dueDate;

    return (
        <div
            className="py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-0"
            style={{ paddingLeft: `${16 + depth * 20}px`, paddingRight: '12px' }}
        >
            <div className="flex items-center gap-3">
                <span className="text-gray-300 dark:text-gray-600 text-xs font-mono flex-shrink-0 w-10">#{issue.iid}</span>
                <a href={issue.webUrl || `${GITLAB_CONFIG.ISSUE_BASE_URL}/${issue.iid}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate font-medium">
                    {issue.title}
                </a>
                {stateBadge(issue.state, issueStatuses.get(issue.iid))}
                {category && (
                    <span className="hidden lg:inline-flex flex-shrink-0 text-xs bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 border border-purple-100 dark:border-purple-800 rounded px-1.5 py-0.5 truncate max-w-32">
                        {category.replace('category::', '')}
                    </span>
                )}
                <div className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 w-20 text-right hidden sm:block">
                    {estimated > 0 ? `${estimated.toFixed(1)}h` : '—'} / {spent > 0 ? `${spent.toFixed(1)}h` : '—'}
                </div>
                <div className="flex-shrink-0 w-16 hidden md:flex justify-end">
                    {deviationBadge(estimated, spent)}
                </div>
                <div className="flex-shrink-0 w-16 flex justify-end">
                    <AssigneeChips assignees={issue.assignees} />
                </div>
            </div>

            {hasMetadata && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 ml-[52px]">
                    {issue.healthStatus && health && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${health}`} />
                            {healthLabel(issue.healthStatus)}
                        </span>
                    )}
                    {issue.milestone && (
                        <span className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 ${
                            isOverdue(issue.milestone.dueDate, isClosed)
                                ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                                : 'bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                        }`}>
                            {issue.milestone.title}
                            {issue.milestone.dueDate && ` · ${fmtDate(issue.milestone.dueDate)}`}
                        </span>
                    )}
                    {issue.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 ${
                            isOverdue(issue.dueDate, isClosed)
                                ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                        }`}>
                            {fmtDate(issue.dueDate)}
                            {isOverdue(issue.dueDate, isClosed) && ' · Überfällig'}
                        </span>
                    )}
                    {issue.weight != null && issue.weight > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5">
                            {issue.weight}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

function EpicProgressBar({ dc }: { dc: Epic['descendantCounts'] }) {
    if (!dc) return null;
    const total = dc.openedIssues + dc.closedIssues;
    if (total === 0) return null;
    const pct = Math.round((dc.closedIssues / total) * 100);
    return (
        <div className="flex items-center gap-2 hidden sm:flex">
            <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">{dc.closedIssues}/{total}</span>
        </div>
    );
}

function EpicNode({
    epic, childEpics, epicIssues, allEpics, allIssues, depth = 0, issueStatuses, defaultExpanded = true,
}: {
    epic: Epic;
    childEpics: Map<string | null, Epic[]>;
    epicIssues: Map<string, Issue[]>;
    allEpics: Epic[];
    allIssues: Issue[];
    depth?: number;
    issueStatuses: Map<string, string>;
    defaultExpanded?: boolean;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const directIssues = epicIssues.get(epic.iid) ?? [];
    const children = childEpics.get(epic.iid) ?? [];
    const totalIssues = epic.descendantCounts?.openedIssues ?? 0;
    const isClosed = epic.state === 'closed';

    const epicEstH = directIssues.reduce((s, i) => s + (i.timeEstimate || 0), 0) / 3600;
    const epicSpentH = directIssues.reduce((s, i) => s + (i.totalTimeSpent || 0), 0) / 3600;

    const duePast = isOverdue(epic.dueDate, isClosed);

    const bgDepth = depth === 0 ? 'bg-gray-100 dark:bg-gray-800' : depth === 1 ? 'bg-gray-50 dark:bg-gray-800/60' : 'bg-white dark:bg-gray-900';
    const borderAccent = depth === 0 ? 'border-l-2 border-l-gray-400 dark:border-l-gray-500' : 'border-l-2 border-l-gray-300 dark:border-l-gray-600';

    return (
        <div className={`${bgDepth}`}>
            <button onClick={() => setExpanded(e => !e)}
                className={`w-full flex items-center gap-2 py-2 hover:brightness-95 text-left border-b border-gray-200 dark:border-gray-700 ${borderAccent}`}
                style={{ paddingLeft: `${12 + depth * 20}px`, paddingRight: '12px' }}>
                <svg
                    className={`w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <a href={epic.webUrl} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className={`font-semibold text-sm hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate ${isClosed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                            {epic.title}
                        </a>
                    </div>
                    {(epic.startDate || epic.dueDate || epicEstH > 0) && (
                        <div className="flex gap-3 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                            {epic.startDate && <span>von {fmtDate(epic.startDate)}</span>}
                            {epic.dueDate && (
                                <span className={duePast ? 'text-red-500 font-medium' : ''}>
                                    bis {fmtDate(epic.dueDate)}{duePast ? ' · Überfällig' : ''}
                                </span>
                            )}
                            {epicEstH > 0 && (
                                <span>{epicEstH.toFixed(1)}h est / {epicSpentH.toFixed(1)}h gebucht</span>
                            )}
                        </div>
                    )}
                </div>

                <EpicProgressBar dc={epic.descendantCounts} />
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:block">
                    {totalIssues} offen{totalIssues !== 1 ? '' : ''}
                </span>
            </button>

            {expanded && (
                <div>
                    {children.map(child => (
                        <EpicNode key={child.iid} epic={child} childEpics={childEpics}
                            epicIssues={epicIssues} allEpics={allEpics} allIssues={allIssues}
                            depth={depth + 1} issueStatuses={issueStatuses} defaultExpanded={defaultExpanded} />
                    ))}
                    {directIssues.map(issue => (
                        <IssueRow key={issue.iid} issue={issue} depth={depth + 1} issueStatuses={issueStatuses} />
                    ))}
                </div>
            )}
        </div>
    );
}

function OrphanGroup({ issues, issueStatuses, defaultExpanded = true }: { issues: Issue[]; issueStatuses: Map<string, string>; defaultExpanded?: boolean }) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    return (
        <div className="bg-gray-100 dark:bg-gray-800 border-l-2 border-l-gray-300 dark:border-l-gray-600">
            <button onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:brightness-95 text-left border-b border-gray-200 dark:border-gray-700">
                <svg
                    className={`w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-semibold text-sm text-gray-500 dark:text-gray-400 flex-1">Ohne Epic</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">{issues.length} Issue{issues.length !== 1 ? 's' : ''}</span>
            </button>
            {expanded && issues.map(issue => (
                <IssueRow key={issue.iid} issue={issue} depth={1} issueStatuses={issueStatuses} />
            ))}
        </div>
    );
}

const IssueDashboard: React.FC<IssueDashboardProps> = ({ issues, epics, issueStatuses, defaultExpanded = true, timelogs, projectMetrics }) => {
    const [stateFilter, setStateFilter] = useState<StateFilter>('opened');
    const { resolvedTheme } = useTheme();
    const dark = resolvedTheme === 'dark';
    // Previous-week bars: muted in dark mode so primary bars stay visually dominant
    const prevOpenedColor = dark ? '#991b1b' : '#fca5a5'; // red-800 vs red-300
    const prevClosedColor = dark ? '#166534' : '#86efac'; // green-800 vs green-300

    // All issues sorted newest-first
    const allSorted = [...issues].sort((a, b) => Number(b.iid) - Number(a.iid));

    // Displayed issues — filtered by toggle
    const filteredIssues = stateFilter === 'all'
        ? allSorted
        : allSorted.filter(i => i.state === stateFilter);

    // Group issues by epic using dual strategy:
    // 1. Forward lookup: issue.epic.iid (reliable when GitLab returns it)
    // 2. Reverse lookup fallback: epic.issues.nodes (for cases where forward lookup yields null)
    const epicIssuesAll = new Map<string, Issue[]>();

    // Pass 1: forward lookup
    const forwardMatched = new Set<string>(); // issue iids matched via forward lookup
    allSorted.forEach(issue => {
        const epicIid = issue.epic?.iid;
        if (!epicIid) return;
        if (!epicIssuesAll.has(epicIid)) epicIssuesAll.set(epicIid, []);
        epicIssuesAll.get(epicIid)!.push(issue);
        forwardMatched.add(issue.iid);
    });

    // Pass 2: reverse lookup for issues not matched in pass 1
    const issueByIid = new Map(allSorted.map(i => [i.iid, i]));
    epics.forEach(epic => {
        epic.issues?.nodes?.forEach(node => {
            if (forwardMatched.has(node.iid)) return; // already placed
            const issue = issueByIid.get(node.iid);
            if (!issue) return;
            if (!epicIssuesAll.has(epic.iid)) epicIssuesAll.set(epic.iid, []);
            epicIssuesAll.get(epic.iid)!.push(issue);
        });
    });


    // Narrow to the visible filter for display
    const epicIssuesFiltered = new Map<string, Issue[]>();
    epicIssuesAll.forEach((issueList, epicIid) => {
        const visible = stateFilter === 'all'
            ? issueList
            : issueList.filter(i => i.state === stateFilter);
        epicIssuesFiltered.set(epicIid, visible);
    });

    const childEpics = new Map<string | null, Epic[]>();
    epics.forEach(epic => {
        const parentIid = epic.parent?.iid ?? null;
        if (!childEpics.has(parentIid)) childEpics.set(parentIid, []);
        childEpics.get(parentIid)!.push(epic);
    });
    const rootEpics = childEpics.get(null) ?? [];

    // Collect all issue iids that are under any epic (via either strategy)
    const assignedIids = new Set<string>();
    epicIssuesAll.forEach(list => list.forEach(i => assignedIids.add(i.iid)));

    // Orphans: issues not assigned to any epic
    const orphanIssues = filteredIssues.filter(i => !assignedIids.has(i.iid));

    const weeklyVolume = buildWeeklyIssueVolume(issues);
    const catIssueCounts = buildCategoryIssueCount(issues);

    const ctx = useDashboardContext();
    const cc = useChartColors();
    const isKwMode = ctx?.timeWindow === 'kw' && !!ctx.customStart && !!ctx.customEnd;

    const dailyCategoryData = isKwMode
        ? buildDailyCategoryData(timelogs, ctx!.customStart!, ctx!.customEnd!)
        : [];

    const catComparisonData = isKwMode ? (() => {
        const currStart = ctx!.customStart!;
        const currEnd = ctx!.customEnd!;
        const prevStart = subDays(currStart, 7);
        const prevEnd = subDays(currEnd, 7);
        const curr = buildCategoryIssueCountForWeek(issues, currStart, currEnd);
        const prev = buildCategoryIssueCountForWeek(issues, prevStart, prevEnd);
        return curr.map((c, i) => ({
            category: c.category,
            prevOpened: prev[i].opened,
            prevClosed: prev[i].closed,
            opened: c.opened,
            closed: c.closed,
        })).filter(c => c.prevOpened + c.prevClosed + c.opened + c.closed > 0);
    })() : [];

    return (
        <div id="issue-zeitanalyse" className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Issues</h2>
            </div>

            {/* Category issue count chart */}
            {(isKwMode ? catComparisonData.length > 0 : catIssueCounts.length > 0) && (
                <div className="mb-8">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Issues pro Kategorie — Offen vs. Geschlossen</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                        {isKwMode ? 'Aktivität in der gewählten KW vs. Vorwoche' : 'Gesamtstand aller Issues je Kategorie'}
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                        {isKwMode ? (
                        <BarChart data={catComparisonData} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Issues', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                            <Tooltip
                                labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                formatter={(v: number, name: string) => [v,
                                    name === 'prevOpened' ? '(Vorwoche) Erstellt' :
                                    name === 'prevClosed' ? '(Vorwoche) Geschlossen' :
                                    name === 'opened'     ? 'Erstellt' : 'Geschlossen']}
                            />
                            <Legend content={() => (
                                <div className="flex gap-4 justify-center text-xs mt-1 text-gray-700 dark:text-gray-300">
                                    {[
                                        { color: prevOpenedColor, label: '(Vorwoche) Erstellt' },
                                        { color: prevClosedColor, label: '(Vorwoche) Geschlossen' },
                                        { color: '#ef4444', label: 'Erstellt' },
                                        { color: '#22c55e', label: 'Geschlossen' },
                                    ].map(({ color, label }) => (
                                        <span key={label} className="flex items-center gap-1">
                                            <span style={{ backgroundColor: color }} className="inline-block w-3 h-3 rounded-sm" />
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            )} />
                            <Bar dataKey="prevOpened" fill={prevOpenedColor} name="prevOpened" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="prevClosed" fill={prevClosedColor} name="prevClosed" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="opened"     fill="#ef4444" name="opened"     radius={[3, 3, 0, 0]} />
                            <Bar dataKey="closed"     fill="#22c55e" name="closed"     radius={[3, 3, 0, 0]} />
                        </BarChart>
                        ) : (
                        <BarChart data={catIssueCounts}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Issues', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                            <Tooltip
                                labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                formatter={(v: number, name: string) => [v, name === 'opened' ? 'Offen' : 'Geschlossen']}
                            />
                            <Legend formatter={n => n === 'opened' ? 'Offen' : 'Geschlossen'} />
                            <Bar dataKey="opened" fill="#ef4444" name="opened" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="closed" fill="#22c55e" name="closed" radius={[3, 3, 0, 0]} />
                        </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            )}

            {/* Kategorie-Trend */}
            {(isKwMode || projectMetrics.sprintData.length > 0) && (
            <div className="mb-8">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {isKwMode ? 'Kategorie-Trend (täglich)' : 'Kategorie-Trend'}
                </h4>
                <ResponsiveContainer width="100%" height={240}>
                    {isKwMode ? (
                    <AreaChart data={dailyCategoryData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: cc.axis }} />
                        <YAxis tick={{ fontSize: 11, fill: cc.axis }} unit="h" label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                            labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                            formatter={(value: number, name: string) => [`${value.toFixed(1)}h`, name]}
                        />
                        <Legend />
                        {CATEGORY_VALUES_TREND.map((category) => {
                            const color = COLORS.CATEGORY[category as keyof typeof COLORS.CATEGORY] ?? '#94a3b8';
                            return (
                                <Area
                                    key={category}
                                    type="monotone"
                                    dataKey={`categoryHours.${category}`}
                                    stackId="1"
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.6}
                                    name={category}
                                />
                            );
                        })}
                    </AreaChart>
                    ) : (
                    <AreaChart data={projectMetrics.sprintData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                        <XAxis dataKey="sprintStart" tick={{ fontSize: 11, fill: cc.axis }} />
                        <YAxis tick={{ fontSize: 11, fill: cc.axis }} label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                            labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                            labelFormatter={(value) => `Sprint ${value}`}
                            formatter={(value: number, name: string) => [`${value.toFixed(1)}h`, name]}
                        />
                        <Legend />
                        {Object.keys(projectMetrics.sprintData[0]?.categoryHours || {}).map((category) => {
                            const color = COLORS.CATEGORY[category as keyof typeof COLORS.CATEGORY] ?? '#94a3b8';
                            return (
                                <Area
                                    key={category}
                                    type="monotone"
                                    dataKey={`categoryHours.${category}`}
                                    stackId="1"
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.6}
                                    name={category}
                                />
                            );
                        })}
                    </AreaChart>
                    )}
                </ResponsiveContainer>
            </div>
            )}

            {/* Toggle + count — only controls the issue tree below */}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 gap-1">
                    {(['all', 'opened', 'closed'] as StateFilter[]).map(s => (
                        <button key={s} onClick={() => setStateFilter(s)}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                stateFilter === s ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}>
                            {s === 'opened' ? 'Offen' : s === 'closed' ? 'Geschlossen' : 'Alle'}
                        </button>
                    ))}
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-500">{filteredIssues.length} Issues</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                <span className="w-2 flex-shrink-0" />
                <span className="w-10 flex-shrink-0">#</span>
                <span className="flex-1">Titel</span>
                <span className="hidden lg:block flex-shrink-0 w-32">Kategorie</span>
                <span className="hidden sm:block flex-shrink-0 w-20 text-right">Est / Ist</span>
                <span className="hidden md:block flex-shrink-0 w-16 text-right">Abw.</span>
                <span className="flex-shrink-0 w-16 text-right">Wer</span>
            </div>

            {filteredIssues.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Keine Issues gefunden</div>
            ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rootEpics.map(epic => (
                        <EpicNode key={epic.iid} epic={epic} childEpics={childEpics}
                            epicIssues={epicIssuesFiltered} allEpics={epics} allIssues={filteredIssues}
                            depth={0} issueStatuses={issueStatuses} defaultExpanded={defaultExpanded} />
                    ))}
                    {orphanIssues.length > 0 && <OrphanGroup issues={orphanIssues} issueStatuses={issueStatuses} defaultExpanded={defaultExpanded} />}
                </div>
            )}

            {/* Analytics */}
        </div>
    );
};

export default IssueDashboard;
