import React, { useState } from 'react';
import { CHART_CONFIG, KPI_LABELS } from '../config/dashboardConfig';
import { ProjectMetrics, Issue } from '@/types/dashboard';

interface ProjectOverviewProps {
    projectMetrics: ProjectMetrics;
    issues: Issue[];
}

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ projectMetrics, issues }) => {
    const missingEstimates = issues.filter(i => i.timeEstimate === 0 && i.totalTimeSpent > 0);
    const [expanded, setExpanded] = useState(false);

    return (
        <div id="projektubersicht" className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">Projektübersicht</h2>
            {missingEstimates.length > 0 && (
                <div className="mb-4 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-base">⚠️</span>
                        <span className="flex-1">
                            <strong>{missingEstimates.length} {missingEstimates.length === 1 ? 'Issue hat' : 'Issues haben'} keine Zeitschätzung</strong>, obwohl Zeit gebucht wurde.
                            Schätzungen setzen mit <code className="rounded bg-yellow-100 dark:bg-yellow-900 px-1">/estimate Xh</code> in der Issue-Beschreibung.
                        </span>
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="ml-2 shrink-0 text-yellow-700 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-200 font-medium underline underline-offset-2"
                        >
                            {expanded ? 'Ausblenden' : 'Anzeigen'}
                        </button>
                    </div>
                    {expanded && (
                        <ul className="mt-2 ml-7 space-y-1">
                            {missingEstimates.map(issue => (
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Team Velocity */}
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{KPI_LABELS.WEEKLY_PERFORMANCE}</h4>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                        {projectMetrics.averageVelocity.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h
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