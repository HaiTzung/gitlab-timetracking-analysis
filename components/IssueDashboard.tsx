'use client';

import React, { useState } from 'react';
import { Issue, Epic, Timelog } from '@/types/dashboard';
import { CATEGORIES, COLORS, DEVIATION_THRESHOLDS, GITLAB_CONFIG } from '@/config/dashboardConfig';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, ScatterChart, Scatter, ReferenceLine, ZAxis, Cell
} from 'recharts';
import { format, differenceInDays, eachWeekOfInterval, parseISO, startOfWeek, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

interface IssueDashboardProps {
    issues: Issue[];
    epics: Epic[];
    timelogs: Timelog[];
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

function AssigneeChips({ assignees }: { assignees: Issue['assignees'] }) {
    if (!assignees?.nodes?.length) return <span className="text-gray-300 text-xs">—</span>;
    return (
        <div className="flex gap-1 flex-wrap">
            {assignees.nodes.map(a => (
                <span key={a.username} title={a.name}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                    {a.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </span>
            ))}
        </div>
    );
}

function IssueRow({ issue, depth = 0 }: { issue: Issue; depth?: number }) {
    const estimated = (issue.timeEstimate || 0) / 3600;
    const spent = (issue.totalTimeSpent || 0) / 3600;
    const category = getMainCategory(issue);
    const isClosed = issue.state === 'closed';
    const health = healthColor(issue.healthStatus);
    const hasMetadata = issue.milestone || issue.iteration || issue.healthStatus || issue.dueDate;

    return (
        <div
            className={`px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 ${isClosed ? 'opacity-60' : ''}`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
            {/* Main row */}
            <div className="flex items-center gap-3">
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${isClosed ? 'bg-gray-400' : 'bg-green-500'}`} />
                <span className="text-gray-400 text-xs font-mono flex-shrink-0 w-10">#{issue.iid}</span>
                <a href={issue.webUrl || `${GITLAB_CONFIG.ISSUE_BASE_URL}/${issue.iid}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-gray-800 hover:text-blue-600 hover:underline truncate font-medium">
                    {issue.title}
                </a>
                {category && (
                    <span className="hidden lg:inline-flex flex-shrink-0 text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 truncate max-w-32">
                        {category.replace('category::', '')}
                    </span>
                )}
                <div className="flex-shrink-0 text-xs text-gray-500 w-20 text-right hidden sm:block">
                    {estimated > 0 ? `${estimated.toFixed(1)}h` : '—'} / {spent > 0 ? `${spent.toFixed(1)}h` : '—'}
                </div>
                <div className="flex-shrink-0 w-16 hidden md:flex justify-end">
                    {deviationBadge(estimated, spent)}
                </div>
                <div className="flex-shrink-0 w-16 flex justify-end">
                    <AssigneeChips assignees={issue.assignees} />
                </div>
            </div>

            {/* Metadata chips row */}
            {hasMetadata && (
                <div className="flex flex-wrap gap-1.5 mt-1.5" style={{ paddingLeft: '26px' }}>
                    {issue.healthStatus && health && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${health}`} />
                            {healthLabel(issue.healthStatus)}
                        </span>
                    )}
                    {issue.milestone && (
                        <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${
                            isOverdue(issue.milestone.dueDate, isClosed)
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}>
                            🏁 {issue.milestone.title}
                            {issue.milestone.dueDate && ` · ${fmtDate(issue.milestone.dueDate)}`}
                        </span>
                    )}
                    {issue.iteration && (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                            🔄 {issue.iteration.title}
                        </span>
                    )}
                    {issue.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${
                            isOverdue(issue.dueDate, isClosed)
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}>
                            📅 {fmtDate(issue.dueDate)}
                            {isOverdue(issue.dueDate, isClosed) && ' · Überfällig'}
                        </span>
                    )}
                    {issue.weight != null && issue.weight > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">
                            ⚖️ {issue.weight}
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
    epic, childEpics, epicIssues, allEpics, allIssues, depth = 0,
}: {
    epic: Epic;
    childEpics: Map<string | null, Epic[]>;
    epicIssues: Map<string, Issue[]>;
    allEpics: Epic[];
    allIssues: Issue[];
    depth?: number;
}) {
    const [expanded, setExpanded] = useState(true);
    const directIssues = epicIssues.get(epic.iid) ?? [];
    const children = childEpics.get(epic.iid) ?? [];
    const totalIssues = directIssues.length + children.reduce((sum, c) => sum + (epicIssues.get(c.iid)?.length ?? 0), 0);
    const isClosed = epic.state === 'closed';

    const epicEstH = directIssues.reduce((s, i) => s + (i.timeEstimate || 0), 0) / 3600;
    const epicSpentH = directIssues.reduce((s, i) => s + (i.totalTimeSpent || 0), 0) / 3600;

    const duePast = isOverdue(epic.dueDate, isClosed);

    return (
        <div>
            <button onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100"
                style={{ paddingLeft: `${12 + depth * 20}px` }}>
                <span className="text-gray-400 text-xs w-4 flex-shrink-0">{expanded ? '▼' : '▶'}</span>
                <span className="text-base flex-shrink-0">🗂</span>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <a href={epic.webUrl} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className={`font-semibold hover:text-blue-600 hover:underline truncate ${isClosed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {epic.title}
                        </a>
                    </div>
                    {/* Epic metadata line */}
                    {(epic.startDate || epic.dueDate) && (
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
                    {totalIssues} Issue{totalIssues !== 1 ? 's' : ''}
                </span>
            </button>

            {expanded && (
                <div>
                    {children.map(child => (
                        <EpicNode key={child.iid} epic={child} childEpics={childEpics}
                            epicIssues={epicIssues} allEpics={allEpics} allIssues={allIssues} depth={depth + 1} />
                    ))}
                    {directIssues.map(issue => (
                        <IssueRow key={issue.iid} issue={issue} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

function OrphanGroup({ issues }: { issues: Issue[] }) {
    const [expanded, setExpanded] = useState(true);
    return (
        <div>
            <button onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100">
                <span className="text-gray-400 text-xs w-4">{expanded ? '▼' : '▶'}</span>
                <span className="text-base">📋</span>
                <span className="font-semibold text-gray-500 flex-1">Ohne Epic</span>
                <span className="text-xs text-gray-400 hidden sm:block">{issues.length} Issue{issues.length !== 1 ? 's' : ''}</span>
            </button>
            {expanded && issues.map(issue => (
                <IssueRow key={issue.iid} issue={issue} depth={1} />
            ))}
        </div>
    );
}

// ─── Analytics ───────────────────────────────────────────────────────────────

function buildBurndown(issues: Issue[]) {
    if (!issues.length) return [];
    const dates = issues.map(i => parseISO(i.createdAt));
    const earliest = dates.reduce((a, b) => a < b ? a : b);
    const weeks = eachWeekOfInterval({ start: earliest, end: new Date() });

    return weeks.map(weekStart => {
        const label = format(weekStart, "'KW' II/yy", { locale: de });
        const opened = issues.filter(i => parseISO(i.createdAt) <= weekStart).length;
        const closed = issues.filter(i => i.closedAt && parseISO(i.closedAt) <= weekStart).length;
        return { week: label, opened, closed };
    });
}

function buildCycleTime(issues: Issue[]) {
    const closed = issues.filter(i => i.state === 'closed' && i.closedAt && i.createdAt);
    const byCategory: Record<string, number[]> = {};
    closed.forEach(i => {
        const cat = getMainCategory(i).replace('category::', '') || 'Sonstige';
        const days = differenceInDays(parseISO(i.closedAt!), parseISO(i.createdAt));
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(days);
    });
    return Object.entries(byCategory).map(([category, days]) => ({
        category,
        avgDays: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
        count: days.length,
    })).sort((a, b) => b.avgDays - a.avgDays);
}

function buildScatter(issues: Issue[]) {
    return issues
        .filter(i => i.state === 'closed' && i.timeEstimate > 0 && i.totalTimeSpent > 0)
        .map(i => ({
            estimated: parseFloat((i.timeEstimate / 3600).toFixed(2)),
            actual: parseFloat((i.totalTimeSpent / 3600).toFixed(2)),
            title: i.title,
            iid: i.iid,
        }));
}

function buildAging(issues: Issue[]) {
    const open = issues.filter(i => i.state === 'opened');
    const buckets = [
        { label: '< 7 Tage', count: 0 },
        { label: '7–14 Tage', count: 0 },
        { label: '14–30 Tage', count: 0 },
        { label: '> 30 Tage', count: 0 },
    ];
    open.forEach(i => {
        const age = differenceInDays(new Date(), parseISO(i.createdAt));
        if (age < 7) buckets[0].count++;
        else if (age < 14) buckets[1].count++;
        else if (age < 30) buckets[2].count++;
        else buckets[3].count++;
    });
    return buckets;
}

function buildSpentByCategory(timelogs: Timelog[]) {
    if (!timelogs.length) return { data: [], categories: [] as string[] };
    const byWeek = new Map<string, Record<string, number>>();

    timelogs.forEach(log => {
        const weekStart = startOfWeek(parseISO(log.spentAt), { weekStartsOn: 1 });
        const weekKey = format(weekStart, "'KW' II/yy", { locale: de });
        const raw = log.issue?.labels?.nodes?.find(l => CATEGORY_VALUES.includes(l.title))?.title ?? '';
        const cat = raw.replace('category::', '') || 'Sonstige';
        if (!byWeek.has(weekKey)) byWeek.set(weekKey, {});
        const row = byWeek.get(weekKey)!;
        row[cat] = (row[cat] ?? 0) + log.timeSpent / 3600;
    });

    const data = Array.from(byWeek.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, values]) => ({ week, ...values }));

    const allCats = [...Object.values(CATEGORIES).map(c => c.replace('category::', '')), 'Sonstige'];
    const categories = allCats.filter(c => data.some(d => (d as Record<string, unknown>)[c]));
    return { data, categories };
}

function buildWeeklyIssueVolume(issues: Issue[]) {
    if (!issues.length) return [];
    const dates = issues.map(i => parseISO(i.createdAt));
    const earliest = dates.reduce((a, b) => a < b ? a : b);
    const weeks = eachWeekOfInterval({ start: earliest, end: new Date() }, { weekStartsOn: 1 });

    return weeks.map(weekStart => {
        const weekEnd = addDays(weekStart, 6);
        const label = format(weekStart, "'KW' II/yy", { locale: de });
        const opened = issues.filter(i => {
            const d = parseISO(i.createdAt);
            return d >= weekStart && d <= weekEnd;
        }).length;
        const closed = issues.filter(i => {
            if (!i.closedAt) return false;
            const d = parseISO(i.closedAt);
            return d >= weekStart && d <= weekEnd;
        }).length;
        return { week: label, opened, closed };
    }).filter(w => w.opened > 0 || w.closed > 0);
}

function AnalyticsSection({ issues, timelogs }: { issues: Issue[]; timelogs: Timelog[] }) {
    const [open, setOpen] = useState(true);
    const spentByCategory = buildSpentByCategory(timelogs);
    const weeklyVolume = buildWeeklyIssueVolume(issues);
    const burndown = buildBurndown(issues);
    const cycleTime = buildCycleTime(issues);
    const scatter = buildScatter(issues);
    const aging = buildAging(issues);
    const maxScatter = Math.max(...scatter.map(d => Math.max(d.estimated, d.actual)), 1);

    return (
        <div className="mt-8 border-t border-gray-200 pt-4">
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 mb-4">
                <span>{open ? '▼' : '▶'}</span>
                <span>Analysen</span>
            </button>

            {open && (
                <div className="grid grid-cols-1 gap-8">
                    {/* Spent time per category per week */}
                    {spentByCategory.data.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Gebuchte Stunden pro Kategorie (wöchentlich)</h4>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={spentByCategory.data}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                                    <YAxis unit="h" />
                                    <Tooltip
                                        labelStyle={{ color: '#111827', fontWeight: 600 }}
                                        formatter={(v: number, name: string) => [`${v.toFixed(1)}h`, name]}
                                    />
                                    <Legend />
                                    {spentByCategory.categories.map(cat => {
                                        const fullKey = `category::${cat}` as keyof typeof COLORS.CATEGORY;
                                        const color = COLORS.CATEGORY[fullKey] ?? '#94a3b8';
                                        return (
                                            <Bar key={cat} dataKey={cat} stackId="a" fill={color} name={cat} />
                                        );
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Weekly issue volume: opened vs closed */}
                    {weeklyVolume.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Issues pro Woche — Geöffnet vs. Geschlossen</h4>
                            <p className="text-xs text-gray-400 mb-2">Neue Issues (nicht kumulativ) pro Kalenderwoche</p>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={weeklyVolume}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip
                                        labelStyle={{ color: '#111827', fontWeight: 600 }}
                                        formatter={(v: number, name: string) => [v, name === 'opened' ? 'Geöffnet' : 'Geschlossen']}
                                    />
                                    <Legend formatter={n => n === 'opened' ? 'Geöffnet' : 'Geschlossen'} />
                                    <Bar dataKey="opened" fill="#ef4444" name="opened" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="closed" fill="#22c55e" name="closed" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Burndown */}
                    {burndown.length > 1 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Burndown — Offen vs. Geschlossen (kumulativ)</h4>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={burndown}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                                    <YAxis />
                                    <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }}
                                        formatter={(v: number, n: string) => [v, n === 'opened' ? 'Geöffnet' : 'Geschlossen']} />
                                    <Legend formatter={n => n === 'opened' ? 'Geöffnet' : 'Geschlossen'} />
                                    <Line type="monotone" dataKey="opened" stroke="#ef4444" strokeWidth={2} dot={false} name="opened" />
                                    <Line type="monotone" dataKey="closed" stroke="#22c55e" strokeWidth={2} dot={false} name="closed" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Cycle time */}
                    {cycleTime.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Durchschnittliche Bearbeitungszeit pro Kategorie (Tage)</h4>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={cycleTime} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" unit=" Tage" />
                                    <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 11 }} />
                                    <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }}
                                        formatter={(v: number, _: string, p: any) => [`${v} Tage (${p.payload.count} Issues)`, 'Ø Bearbeitungszeit']} />
                                    <Bar dataKey="avgDays" fill="#6366f1" name="Ø Tage" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Estimate accuracy scatter */}
                    {scatter.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Schätzgenauigkeit — Geschätzt vs. Tatsächlich (h)</h4>
                            <p className="text-xs text-gray-400 mb-2">Punkte auf der Linie = perfekte Schätzung · darüber = Überschreitung · darunter = Unterschreitung</p>
                            <ResponsiveContainer width="100%" height={260}>
                                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" dataKey="estimated" name="Geschätzt" unit="h" domain={[0, maxScatter * 1.1]} />
                                    <YAxis type="number" dataKey="actual" name="Tatsächlich" unit="h" domain={[0, maxScatter * 1.1]} />
                                    <ZAxis range={[40, 40]} />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }}
                                        content={({ payload }) => {
                                            if (!payload?.length) return null;
                                            const d = payload[0].payload;
                                            return (
                                                <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
                                                    <p className="font-semibold text-gray-800 mb-1">#{d.iid} {d.title}</p>
                                                    <p>Geschätzt: {d.estimated}h</p>
                                                    <p>Tatsächlich: {d.actual}h</p>
                                                </div>
                                            );
                                        }}
                                    />
                                    <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxScatter, y: maxScatter }]}
                                        stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Perfekt', position: 'insideTopLeft', fontSize: 11, fill: '#94a3b8' }} />
                                    <Scatter data={scatter} fill="#3b82f6" fillOpacity={0.7} />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Aging */}
                    {aging.some(b => b.count > 0) && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Offene Issues nach Alter</h4>
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart data={aging}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }}
                                        formatter={(v: number) => [v, 'Issues']} />
                                    <Bar dataKey="count" name="Issues" radius={[4, 4, 0, 0]}>
                                        {aging.map((_, i) => (
                                            <Cell key={i} fill={i === 0 ? '#22c55e' : i === 1 ? '#86efac' : i === 2 ? '#f59e0b' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

const IssueDashboard: React.FC<IssueDashboardProps> = ({ issues, epics, timelogs }) => {
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

    console.log('epicIssuesAll keys:', epicIssuesAll.size, [...epicIssuesAll.entries()].map(([k,v]) => `${k}:${v.length}`));

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

    const issuesWithTime = allSorted.map(issue => ({
        ...issue,
        mainCategory: getMainCategory(issue),
        estimatedH: (issue.timeEstimate || 0) / 3600,
        spentH: (issue.totalTimeSpent || 0) / 3600,
    })).filter(i => i.mainCategory && (i.estimatedH > 0 || i.spentH > 0));

    const categoryComparison = CATEGORY_VALUES.map(cat => {
        const catIssues = issuesWithTime.filter(i => i.mainCategory === cat && i.spentH > 0);
        return {
            category: cat.replace('category::', ''),
            estimated: catIssues.reduce((s, i) => s + i.estimatedH, 0),
            actual: catIssues.reduce((s, i) => s + i.spentH, 0),
        };
    }).filter(c => c.estimated > 0 || c.actual > 0);

    return (
        <div id="issue-zeitanalyse" className="bg-white p-4 rounded-lg shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="text-xl font-bold text-gray-800">Issues</h2>
            </div>

            {/* Category comparison chart — always all issues */}
            {categoryComparison.length > 0 && (
                <div className="mb-8">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Geschätzt vs. Gebucht pro Kategorie</h4>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={categoryComparison}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" />
                            <YAxis />
                            <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }}
                                formatter={(value: number, name: string) => [`${value.toFixed(1)}h`, name]} />
                            <Legend />
                            <Bar dataKey="estimated" fill="#8884d8" name="Geschätzt" />
                            <Bar dataKey="actual" fill="#82ca9d" name="Gebucht" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Toggle + count — only controls the issue tree below */}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
                    {(['opened', 'all', 'closed'] as StateFilter[]).map(s => (
                        <button key={s} onClick={() => setStateFilter(s)}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                stateFilter === s ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}>
                            {s === 'opened' ? '🟢 Offen' : s === 'closed' ? '⚫ Geschlossen' : '📋 Alle'}
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
                            epicIssues={epicIssuesFiltered} allEpics={epics} allIssues={filteredIssues} depth={0} />
                    ))}
                    {orphanIssues.length > 0 && <OrphanGroup issues={orphanIssues} />}
                </div>
            )}

            {/* Analytics */}
            <AnalyticsSection issues={issues} timelogs={timelogs} />
        </div>
    );
};

export default IssueDashboard;
