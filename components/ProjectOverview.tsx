import React, { memo, useState, useMemo } from 'react';
import { CHART_CONFIG, KPI_LABELS, CATEGORY_LABELS } from '../config/dashboardConfig';
import { ProjectMetrics, Issue, Timelog } from '@/types/dashboard';
import { TimeWindow } from '@/context/DashboardContext';
import { startOfWeek, addDays, format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ProjectOverviewProps {
    projectMetrics: ProjectMetrics;
    issues: Issue[];
    windowTimelogs: Timelog[];
    allTimelogs: Timelog[];
    tuOffset: boolean;
    timeWindow: TimeWindow;
    customStart: Date | null;
    customEnd: Date | null;
    issueStatuses: Map<string, string>;
}

interface Warning {
    key: string;
    issues: Issue[];
    label: string;
    detail: string;
}

const WARNINGS = (issueStatuses: Map<string, string>): Array<Omit<Warning, 'issues'> & { filter: (issues: Issue[]) => Issue[] }> => [
    {
        key: 'closed-no-estimate',
        filter: (issues) => issues.filter(i => i.state === 'closed' && i.timeEstimate === 0 && i.totalTimeSpent > 0),
        label: 'Geschlossen ohne Zeitschätzung',
        detail: 'Schätzungen setzen mit /estimate Xh',
    },
    {
        key: 'open-no-estimate',
        filter: (issues) => issues.filter(i => i.state === 'opened' && i.timeEstimate === 0),
        label: 'Offen ohne Zeitschätzung',
        detail: 'Schätzungen setzen mit /estimate Xh',
    },
    {
        key: 'no-label',
        filter: (issues) => issues.filter(i => !i.labels.nodes.some(l => l.title.startsWith('category::'))),
        label: 'Kein Kategorie-Label',
        detail: 'Label der Form category::… vergeben',
    },
    {
        key: 'no-parent',
        filter: (issues) => issues.filter(i => !i.epic),
        label: 'Kein übergeordnetes Issue/Epic',
        detail: 'Issue einem Epic oder Parent zuordnen',
    },
    {
        key: 'missing-milestone',
        filter: (issues) => issues.filter(i =>
            !i.labels.nodes.some(l => l.title === 'category::project-management') && !i.milestone
        ),
        label: 'Kein Milestone (Pflicht außer project-management)',
        detail: 'Milestone zuweisen für Sprint-Tracking',
    },
    {
        key: 'unwanted-milestone',
        filter: (issues) => issues.filter(i =>
            i.labels.nodes.some(l => l.title === 'category::project-management') && !!i.milestone
        ),
        label: 'Milestone gesetzt (nicht erlaubt bei project-management)',
        detail: 'Milestone bei category::project-management entfernen',
    },
    {
        key: 'short-description',
        filter: (issues) => issues.filter(i => (i.description ?? '').trim().length < 50),
        label: 'Beschreibung unter 50 Zeichen',
        detail: 'Aussagekräftige Beschreibung hinzufügen',
    },
    {
        key: 'low-time',
        filter: (issues) => issues.filter(i => {
            if (i.state !== 'closed') return false;
            const isWontDo = issueStatuses.get(i.iid) === "Won't do";
            if (isWontDo && i.totalTimeSpent === 0) return false;
            return i.totalTimeSpent < 600;
        }),
        label: 'Weniger als 10 Minuten gebucht',
        detail: 'Zeit nachbuchen oder Issue prüfen',
    },
];

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ projectMetrics, issues, windowTimelogs, allTimelogs, tuOffset, timeWindow, customStart, customEnd, issueStatuses }) => {
    const [rootOpen, setRootOpen] = useState(false);
    const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

    const isKwMode = timeWindow === 'kw' && !!customStart && !!customEnd;

    // KW-mode derived metrics
    const kwTotalHours = windowTimelogs.reduce((s, t) => s + t.timeSpent / 3600, 0);
    const kwMemberCount = new Set(windowTimelogs.map(t => t.user.name)).size;
    const kwAvgPerMember = kwMemberCount > 0 ? kwTotalHours / kwMemberCount : 0;
    const kwClosedIssues = isKwMode
        ? issues.filter(i => i.state === 'closed' && i.closedAt && new Date(i.closedAt) >= customStart! && new Date(i.closedAt) <= customEnd!)
        : [];
    const kwAvgCloseTime = kwClosedIssues.length > 0
        ? kwClosedIssues.reduce((s, i) => s + i.totalTimeSpent, 0) / kwClosedIssues.length / 3600
        : 0;

    const trendData = useMemo(() => {
        const inRange = (dateStr: string, b: { start: Date; end: Date }) => {
            const d = new Date(dateStr);
            return d >= b.start && d <= b.end;
        };

        let curr: { start: Date; end: Date };
        let prev: { start: Date; end: Date };

        if (timeWindow === 'kw' && customStart && customEnd) {
            // Use the exact KW selection from the sidebar — same dates as the table
            curr = { start: customStart, end: customEnd };
            // Prev = same window shifted back 7 days
            prev = { start: addDays(customStart, -7), end: addDays(customEnd, -7) };
        } else {
            const today = new Date();
            const monAnchor = startOfWeek(today, { weekStartsOn: 1 });
            const prevMonAnchor = addDays(monAnchor, -7);
            const kwBounds = (monDay: Date) => ({
                start: tuOffset ? addDays(monDay, 1) : monDay,
                end:   tuOffset
                    ? new Date(new Date(addDays(monDay, 7)).setHours(23, 59, 59, 0))
                    : new Date(new Date(addDays(monDay, 7)).setHours(0, 0, 0, 0)),
            });
            curr = kwBounds(monAnchor);
            prev = kwBounds(prevMonAnchor);
        }

        const currLogs = allTimelogs.filter(t => inRange(t.spentAt, curr));
        const prevLogs = allTimelogs.filter(t => inRange(t.spentAt, prev));

        const currHours = currLogs.reduce((s, t) => s + t.timeSpent / 3600, 0);
        const prevHours = prevLogs.reduce((s, t) => s + t.timeSpent / 3600, 0);

        const currClosed = issues.filter(i => i.closedAt && inRange(i.closedAt, curr)).length;
        const prevClosed = issues.filter(i => i.closedAt && inRange(i.closedAt, prev)).length;

        const pct = (c: number, p: number) =>
            p === 0 ? null : Math.round(((c - p) / p) * 100);

        const lastLog = allTimelogs.length
            ? allTimelogs.reduce((a, b) => (a.spentAt > b.spentAt ? a : b))
            : null;
        const daysSince = lastLog
            ? Math.floor((Date.now() - new Date(lastLog.spentAt).getTime()) / 86400000)
            : null;

        const dateLabel = `${format(curr.start, 'dd.MM', { locale: de })}–${format(curr.end, 'dd.MM', { locale: de })}`;

        return {
            currHours, prevHours, hoursPct: pct(currHours, prevHours),
            currEvents: currLogs.length, prevEvents: prevLogs.length, eventsPct: pct(currLogs.length, prevLogs.length),
            currClosed, prevClosed, closedPct: pct(currClosed, prevClosed),
            daysSince, dateLabel,
        };
    }, [allTimelogs, issues, tuOffset, timeWindow, customStart, customEnd]);

    const warnings: Warning[] = WARNINGS(issueStatuses)
        .map(({ filter, ...rest }) => ({ ...rest, issues: filter(issues) }))
        .filter(w => w.issues.length > 0);

    const totalAffected = new Set(warnings.flatMap(w => w.issues.map(i => i.iid))).size;

    const toggleKey = (key: string) =>
        setOpenKeys(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });

    return (
        <div id="projektubersicht" className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">Projektübersicht</h2>

            {warnings.length > 0 && (
                <div className="mb-4 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950 text-sm text-yellow-800 dark:text-yellow-300 overflow-hidden">
                    {/* Root row */}
                    <button
                        onClick={() => setRootOpen(o => !o)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                    >
                        <span className="text-base">⚠️</span>
                        <span className="flex-1 font-semibold">
                            {totalAffected} {totalAffected === 1 ? 'Issue hat' : 'Issues haben'} Qualitätsprobleme
                            <span className="font-normal ml-1.5 text-yellow-700 dark:text-yellow-400">
                                ({warnings.length} {warnings.length === 1 ? 'Kategorie' : 'Kategorien'})
                            </span>
                        </span>
                        <svg
                            className={`shrink-0 transition-transform ${rootOpen ? 'rotate-180' : ''}`}
                            width="14" height="14" viewBox="0 0 12 12" fill="none"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        >
                            <path d="M2 4l4 4 4-4" />
                        </svg>
                    </button>

                    {/* Category rows */}
                    {rootOpen && (
                        <div className="border-t border-yellow-200 dark:border-yellow-800">
                            {warnings.map((w, idx) => (
                                <div key={w.key} className={idx > 0 ? 'border-t border-yellow-200 dark:border-yellow-800' : ''}>
                                    {/* Category row */}
                                    <button
                                        onClick={() => toggleKey(w.key)}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 pl-8 text-left hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                                    >
                                        <span className="flex-1">
                                            <span className="font-medium">{w.label}</span>
                                            <span className="ml-2 text-yellow-600 dark:text-yellow-500 text-xs tabular-nums">
                                                {w.issues.length} {w.issues.length === 1 ? 'Issue' : 'Issues'}
                                            </span>
                                            {w.detail && (
                                                <span className="ml-2 text-yellow-600 dark:text-yellow-500 text-xs">
                                                    — {w.detail}
                                                </span>
                                            )}
                                        </span>
                                        <svg
                                            className={`shrink-0 transition-transform ${openKeys.has(w.key) ? 'rotate-180' : ''}`}
                                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                                        >
                                            <path d="M2 4l4 4 4-4" />
                                        </svg>
                                    </button>

                                    {/* Issue links */}
                                    {openKeys.has(w.key) && (
                                        <ul className="pb-2 pl-12 pr-4 space-y-1">
                                            {w.issues.map(issue => (
                                                <li key={issue.iid}>
                                                    <a
                                                        href={issue.webUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-yellow-900 dark:text-yellow-300 underline underline-offset-2 hover:text-yellow-700 dark:hover:text-yellow-100"
                                                    >
                                                        #{issue.iid} {issue.title}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 1. Weekly performance / KW avg per member */}
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg flex flex-col">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                        {isKwMode ? 'Ø Zeit pro Mitglied (KW)' : KPI_LABELS.WEEKLY_PERFORMANCE}
                    </h4>
                    {isKwMode ? (
                        <>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                                {kwAvgPerMember.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
                            </p>
                            <p className="text-sm text-blue-600 dark:text-blue-400 mt-auto">
                                {kwMemberCount} {kwMemberCount === 1 ? 'Mitglied' : 'Mitglieder'} · {kwTotalHours.toFixed(1)}h gesamt
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                                {(projectMetrics.averageVelocity || 0).toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
                            </p>
                            <p className="text-sm text-blue-600 dark:text-blue-400 mt-auto">
                                {projectMetrics.totalSprints} {KPI_LABELS.ACTIVE_WEEKS}
                            </p>
                        </>
                    )}
                </div>

                {/* 2. Most Active Category (unchanged) */}
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg flex flex-col">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">{KPI_LABELS.MAIN_FOCUS}</h4>
                    {(() => {
                        const mainCategory = [...projectMetrics.categoryDistribution]
                            .sort((a, b) => b.hours - a.hours)[0];
                        if (!mainCategory) return <p className="text-sm text-green-600 dark:text-green-400">Keine Daten</p>;
                        return (
                            <>
                                <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                                    {CATEGORY_LABELS[mainCategory.category] ?? mainCategory.category.replace('category::', '')}
                                </p>
                                <p className="text-sm text-green-600 dark:text-green-400 mt-auto">
                                    {mainCategory.hours.toFixed(CHART_CONFIG.DECIMAL_PLACES)}{isKwMode ? 'h diese Woche' : KPI_LABELS.HOURS_PER_WEEK}
                                </p>
                            </>
                        );
                    })()}
                </div>

                {/* 3. Issue completion time — scoped to KW when in KW mode */}
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg flex flex-col">
                    <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">
                        {KPI_LABELS.ISSUE_COMPLETION_TIME}
                    </h4>
                    {isKwMode ? (
                        <>
                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                                {kwAvgCloseTime.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
                            </p>
                            <p className="text-sm text-purple-600 dark:text-purple-400 mt-auto">
                                {kwClosedIssues.length} {kwClosedIssues.length === 1 ? 'Issue geschlossen' : 'Issues geschlossen'}
                            </p>
                        </>
                    ) : (
                        <>
                            {(() => {
                                const completedIssues = issues.filter(issue => issue.totalTimeSpent > 0);
                                const avgTime = completedIssues.length > 0
                                    ? completedIssues.reduce((sum, issue) => sum + issue.totalTimeSpent, 0) / completedIssues.length / 3600
                                    : 0;
                                return (
                                    <>
                                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                                            {avgTime.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
                                        </p>
                                        <p className="text-sm text-purple-600 dark:text-purple-400 mt-auto">
                                            {completedIssues.length} {KPI_LABELS.COMPLETED_ISSUES}
                                        </p>
                                    </>
                                );
                            })()}
                        </>
                    )}
                </div>

                {/* 4. Most productive week / KW total hours */}
                <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg flex flex-col">
                    <h4 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
                        {isKwMode ? 'Gesamtzeit (KW)' : KPI_LABELS.MOST_ACTIVE_WEEK}
                    </h4>
                    {isKwMode ? (
                        <>
                            <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                                {kwTotalHours.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
                            </p>
                            <p className="text-sm text-orange-600 dark:text-orange-400 mt-auto">
                                {windowTimelogs.length} {windowTimelogs.length === 1 ? 'Buchung' : 'Buchungen'}
                            </p>
                        </>
                    ) : (
                        <>
                            {(() => {
                                const mostProductiveWeek = [...projectMetrics.sprintData]
                                    .sort((a, b) => b.totalHours - a.totalHours)[0];
                                if (!mostProductiveWeek) return <p className="text-sm text-orange-600 dark:text-orange-400">Keine Daten</p>;
                                return (
                                    <>
                                        <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                                            {mostProductiveWeek.totalHours.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
                                        </p>
                                        <p className="text-sm text-orange-600 dark:text-orange-400 mt-auto">
                                            {mostProductiveWeek.sprintStart} - {mostProductiveWeek.sprintEnd}
                                        </p>
                                    </>
                                );
                            })()}
                        </>
                    )}
                </div>
            </div>

            {/* Trends section */}
            {(() => {
                const TrendBadge = ({ pct }: { pct: number | null }) => {
                    if (pct === null) return null;
                    const up = pct >= 0;
                    return (
                        <span className={`text-sm font-semibold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {up ? '↑' : '↓'}{Math.abs(pct)}%
                        </span>
                    );
                };
                const tiles = [
                    {
                        label: 'Zeitaufwand',
                        value: `${trendData.currHours.toFixed(1)}h`,
                        pct: trendData.hoursPct,
                        hint: `Vorwoche: ${trendData.prevHours.toFixed(1)}h`,
                        bg: 'bg-blue-50 dark:bg-blue-950',
                        labelCls: 'text-blue-800 dark:text-blue-300',
                        valueCls: 'text-blue-900 dark:text-blue-200',
                        hintCls: 'text-blue-600 dark:text-blue-400',
                    },
                    {
                        label: 'Buchungsereignisse',
                        value: String(trendData.currEvents),
                        pct: trendData.eventsPct,
                        hint: `Vorwoche: ${trendData.prevEvents}`,
                        bg: 'bg-indigo-50 dark:bg-indigo-950',
                        labelCls: 'text-indigo-800 dark:text-indigo-300',
                        valueCls: 'text-indigo-900 dark:text-indigo-200',
                        hintCls: 'text-indigo-600 dark:text-indigo-400',
                    },
                    {
                        label: 'Geschlossene Issues',
                        value: String(trendData.currClosed),
                        pct: trendData.closedPct,
                        hint: `Vorwoche: ${trendData.prevClosed}`,
                        bg: 'bg-emerald-50 dark:bg-emerald-950',
                        labelCls: 'text-emerald-800 dark:text-emerald-300',
                        valueCls: 'text-emerald-900 dark:text-emerald-200',
                        hintCls: 'text-emerald-600 dark:text-emerald-400',
                    },
                    {
                        label: 'Letzte Aktivität',
                        value: trendData.daysSince === null ? '–' : trendData.daysSince === 0 ? 'Heute' : `${trendData.daysSince}d`,
                        pct: null as number | null,
                        hint: trendData.daysSince !== null && trendData.daysSince > 3 ? 'Keine aktuelle Buchung' : 'Zuletzt aktiv',
                        bg: trendData.daysSince !== null && trendData.daysSince > 3
                            ? 'bg-amber-50 dark:bg-amber-950'
                            : 'bg-orange-50 dark:bg-orange-950',
                        labelCls: trendData.daysSince !== null && trendData.daysSince > 3
                            ? 'text-amber-800 dark:text-amber-300'
                            : 'text-orange-800 dark:text-orange-300',
                        valueCls: trendData.daysSince !== null && trendData.daysSince > 3
                            ? 'text-amber-900 dark:text-amber-200'
                            : 'text-orange-900 dark:text-orange-200',
                        hintCls: trendData.daysSince !== null && trendData.daysSince > 3
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-orange-600 dark:text-orange-400',
                    },
                ];
                return (
                    <div className="mt-4">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Trends diese Woche <span className="normal-case font-normal text-gray-400 dark:text-gray-500">({trendData.dateLabel})</span></h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {tiles.map(tile => (
                                <div key={tile.label} className={`${tile.bg} p-4 rounded-lg flex flex-col`}>
                                    <h4 className={`text-sm font-medium ${tile.labelCls} mb-2`}>{tile.label}</h4>
                                    <div className="flex items-baseline gap-1.5">
                                        <p className={`text-2xl font-bold ${tile.valueCls}`}>{tile.value}</p>
                                        <TrendBadge pct={tile.pct} />
                                    </div>
                                    <p className={`text-sm ${tile.hintCls} mt-auto`}>{tile.hint}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default memo(ProjectOverview);
