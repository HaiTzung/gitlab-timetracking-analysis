'use client';

import React, { useState } from 'react';
import { Issue, Epic } from '@/types/dashboard';
import { CATEGORIES, COLORS, DEVIATION_THRESHOLDS, GITLAB_CONFIG } from '@/config/dashboardConfig';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, eachWeekOfInterval, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

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
    const color = estimated === 0 ? 'bg-gray-100 text-gray-600'
        : Math.abs(pct) <= DEVIATION_THRESHOLDS.EXCELLENT ? 'bg-green-100 text-green-700'
        : Math.abs(pct) <= DEVIATION_THRESHOLDS.GOOD ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
    return <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}

function stateBadge(state: string, statusName?: string) {
    const isInProgress = state === 'opened' &&
        statusName?.toLowerCase().includes('in progress');

    if (state === 'opened' && isInProgress) return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            In Bearbeitung
        </span>
    );
    if (state === 'opened') return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Offen
        </span>
    );
    if (state === 'closed') return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-xs bg-gray-100 text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Geschlossen
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 flex-shrink-0 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-1.5 py-0.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            {state}
        </span>
    );
}

function AssigneeChips({ assignees }: { assignees: Issue['assignees'] }) {
    if (!assignees?.nodes?.length) return <span className="text-gray-300 text-xs">—</span>;
    return (
        <div className="flex flex-wrap gap-1 justify-end" style={{ maxWidth: '52px' }}>
            {assignees.nodes.map(a => (
                <span key={a.username} title={a.name}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex-shrink-0">
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
            className="py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
            style={{ paddingLeft: `${16 + depth * 20}px`, paddingRight: '12px' }}
        >
            <div className="flex items-center gap-3">
                <span className="text-gray-300 text-xs font-mono flex-shrink-0 w-10">#{issue.iid}</span>
                <a href={issue.webUrl || `${GITLAB_CONFIG.ISSUE_BASE_URL}/${issue.iid}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-gray-700 hover:text-blue-600 hover:underline truncate font-medium">
                    {issue.title}
                </a>
                {stateBadge(issue.state, issueStatuses.get(issue.iid))}
                {category && (
                    <span className="hidden lg:inline-flex flex-shrink-0 text-xs bg-purple-50 text-purple-600 border border-purple-100 rounded px-1.5 py-0.5 truncate max-w-32">
                        {category.replace('category::', '')}
                    </span>
                )}
                <div className="flex-shrink-0 text-xs text-gray-400 w-20 text-right hidden sm:block">
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
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${health}`} />
                            {healthLabel(issue.healthStatus)}
                        </span>
                    )}
                    {issue.milestone && (
                        <span className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 ${
                            isOverdue(issue.milestone.dueDate, isClosed)
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-orange-50 text-orange-600 border border-orange-200'
                        }`}>
                            {issue.milestone.title}
                            {issue.milestone.dueDate && ` · ${fmtDate(issue.milestone.dueDate)}`}
                        </span>
                    )}
                    {issue.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 ${
                            isOverdue(issue.dueDate, isClosed)
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}>
                            {fmtDate(issue.dueDate)}
                            {isOverdue(issue.dueDate, isClosed) && ' · Überfällig'}
                        </span>
                    )}
                    {issue.weight != null && issue.weight > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
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
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-400">{dc.closedIssues}/{total}</span>
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

    const bgDepth = depth === 0 ? 'bg-gray-100' : depth === 1 ? 'bg-gray-50' : 'bg-white';
    const borderAccent = depth === 0 ? 'border-l-2 border-l-gray-400' : 'border-l-2 border-l-gray-300';

    return (
        <div className={`${bgDepth}`}>
            <button onClick={() => setExpanded(e => !e)}
                className={`w-full flex items-center gap-2 py-2 hover:brightness-95 text-left border-b border-gray-200 ${borderAccent}`}
                style={{ paddingLeft: `${12 + depth * 20}px`, paddingRight: '12px' }}>
                <svg
                    className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <a href={epic.webUrl} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className={`font-semibold text-sm hover:text-blue-600 hover:underline truncate ${isClosed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {epic.title}
                        </a>
                    </div>
                    {(epic.startDate || epic.dueDate || epicEstH > 0) && (
                        <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
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
                <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
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
        <div className="bg-gray-100 border-l-2 border-l-gray-300">
            <button onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:brightness-95 text-left border-b border-gray-200">
                <svg
                    className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-semibold text-sm text-gray-500 flex-1">Ohne Epic</span>
                <span className="text-xs text-gray-400 hidden sm:block">{issues.length} Issue{issues.length !== 1 ? 's' : ''}</span>
            </button>
            {expanded && issues.map(issue => (
                <IssueRow key={issue.iid} issue={issue} depth={1} issueStatuses={issueStatuses} />
            ))}
        </div>
    );
}

const IssueDashboard: React.FC<IssueDashboardProps> = ({ issues, epics, issueStatuses, defaultExpanded = true }) => {
    const [stateFilter, setStateFilter] = useState<StateFilter>('opened');

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

    return (
        <div id="issue-zeitanalyse" className="bg-white p-4 rounded-lg shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="text-xl font-bold text-gray-800">Issues</h2>
            </div>

            {/* Category issue count chart */}
            {catIssueCounts.length > 0 && (
                <div className="mb-8">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Issues pro Kategorie — Offen vs. Geschlossen</h4>
                    <p className="text-xs text-gray-400 mb-3">Gesamtstand aller Issues je Kategorie</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={catIssueCounts}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip
                                labelStyle={{ color: '#111827', fontWeight: 600 }}
                                formatter={(v: number, name: string) => [v, name === 'opened' ? 'Offen' : 'Geschlossen']}
                            />
                            <Legend formatter={n => n === 'opened' ? 'Offen' : 'Geschlossen'} />
                            <Bar dataKey="opened" fill="#ef4444" name="opened" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="closed" fill="#22c55e" name="closed" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Toggle + count — only controls the issue tree below */}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
                    {(['all', 'opened', 'closed'] as StateFilter[]).map(s => (
                        <button key={s} onClick={() => setStateFilter(s)}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                stateFilter === s ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}>
                            {s === 'opened' ? 'Offen' : s === 'closed' ? 'Geschlossen' : 'Alle'}
                        </button>
                    ))}
                </div>
                <span className="text-sm text-gray-400">{filteredIssues.length} Issues</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                <span className="w-2 flex-shrink-0" />
                <span className="w-10 flex-shrink-0">#</span>
                <span className="flex-1">Titel</span>
                <span className="hidden lg:block flex-shrink-0 w-32">Kategorie</span>
                <span className="hidden sm:block flex-shrink-0 w-20 text-right">Est / Ist</span>
                <span className="hidden md:block flex-shrink-0 w-16 text-right">Abw.</span>
                <span className="flex-shrink-0 w-16 text-right">Wer</span>
            </div>

            {filteredIssues.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">Keine Issues gefunden</div>
            ) : (
                <div className="divide-y divide-gray-100">
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
