import React, { useState } from 'react';
import { CHART_CONFIG, KPI_LABELS } from '../config/dashboardConfig';
import { ProjectMetrics, Issue } from '@/types/dashboard';

interface ProjectOverviewProps {
    projectMetrics: ProjectMetrics;
    issues: Issue[];
}

interface Warning {
    key: string;
    issues: Issue[];
    label: string;
    detail: string;
}

const WARNINGS: Array<Omit<Warning, 'issues'> & { filter: (issues: Issue[]) => Issue[] }> = [
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
        key: 'no-epic',
        filter: (issues) => issues.filter(i => !i.epic),
        label: 'Kein Epic',
        detail: 'Issue einem Epic zuordnen',
    },
    {
        key: 'no-milestone',
        filter: (issues) => issues.filter(i => !i.milestone),
        label: 'Kein Milestone',
        detail: 'Milestone zuweisen für Sprint-Tracking',
    },
    {
        key: 'short-description',
        filter: (issues) => issues.filter(i => (i.description ?? '').trim().length < 50),
        label: 'Beschreibung unter 50 Zeichen',
        detail: 'Aussagekräftige Beschreibung hinzufügen',
    },
    {
        key: 'closed-no-time',
        filter: (issues) => issues.filter(i => i.state === 'closed' && i.totalTimeSpent === 0),
        label: 'Geschlossen ohne gebuchte Zeit',
        detail: 'Zeit nachbuchen oder Issue prüfen',
    },
];

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ projectMetrics, issues }) => {
    const [rootOpen, setRootOpen] = useState(false);
    const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

    const warnings: Warning[] = WARNINGS
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
                {/* Team Velocity */}
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{KPI_LABELS.WEEKLY_PERFORMANCE}</h4>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                        {(projectMetrics.averageVelocity || 0).toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        {projectMetrics.totalSprints} {KPI_LABELS.ACTIVE_WEEKS}
                    </p>
                </div>

                {/* Most Active Category */}
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">{KPI_LABELS.MAIN_FOCUS}</h4>
                    {(() => {
                        const mainCategory = [...projectMetrics.categoryDistribution]
                            .sort((a, b) => b.hours - a.hours)[0];
                        if (!mainCategory) return <p className="text-sm text-green-600 dark:text-green-400">Keine Daten</p>;
                        return (
                            <>
                                <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                                    {mainCategory.category}
                                </p>
                                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                    {mainCategory.hours.toFixed(CHART_CONFIG.DECIMAL_PLACES)}{KPI_LABELS.HOURS_PER_WEEK}
                                </p>
                            </>
                        );
                    })()}
                </div>

                {/* Average Issue Completion Time */}
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">{KPI_LABELS.ISSUE_COMPLETION_TIME}</h4>
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
                                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                                    {completedIssues.length} {KPI_LABELS.COMPLETED_ISSUES}
                                </p>
                            </>
                        );
                    })()}
                </div>

                {/* Most Productive Week */}
                <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">{KPI_LABELS.MOST_ACTIVE_WEEK}</h4>
                    {(() => {
                        const mostProductiveWeek = [...projectMetrics.sprintData]
                            .sort((a, b) => b.totalHours - a.totalHours)[0];
                        if (!mostProductiveWeek) return <p className="text-sm text-orange-600 dark:text-orange-400">Keine Daten</p>;
                        return (
                            <>
                                <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                                    {mostProductiveWeek.totalHours.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
                                </p>
                                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                                    {mostProductiveWeek.sprintStart} - {mostProductiveWeek.sprintEnd}
                                </p>
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default ProjectOverview;
