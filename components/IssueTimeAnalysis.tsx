import React from 'react';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer, Cell
} from 'recharts';
import { 
    CHART_CONFIG, 
    CHART_TITLES, 
    TOOLTIP_LABELS, 
    CHART_LABELS, 
    GITLAB_CONFIG,
    CATEGORIES,
    DEVIATION_THRESHOLDS
} from '@/config/dashboardConfig';
import { Issue } from '@/types/dashboard';

interface IssueTimeAnalysisProps {
    issues: Issue[];
}

const IssueTimeAnalysis: React.FC<IssueTimeAnalysisProps> = ({ issues }) => {
    // Create issue map for efficient lookup
    const issueMap = new Map<string, Issue>();
    issues.forEach(issue => {
        issueMap.set(issue.iid, issue);
    });

    // Filter issues that have a main category and either estimated or booked time
    const filteredIssues = issues.filter(issue => {
        const hasMainCategory = issue.labels && issue.labels.nodes && 
            issue.labels.nodes.some(label => 
                (Object.values(CATEGORIES) as string[]).includes(label.title)
            );
        const hasTimeData = (issue.timeEstimate || 0) > 0 || (issue.totalTimeSpent || 0) > 0;
        return hasMainCategory && hasTimeData;
    });

    // Get main category for each issue
    const getMainCategory = (issue: Issue): string => {
        if (!issue.labels || !issue.labels.nodes) return '';
        const mainCategory = issue.labels.nodes.find(label => 
            (Object.values(CATEGORIES) as string[]).includes(label.title)
        );
        return mainCategory ? mainCategory.title : '';
    };

    // Calculate deviation for each issue
    const issuesWithDeviation = filteredIssues.map(issue => {
        const timeEstimate = issue.timeEstimate || 0;
        const totalTimeSpent = issue.totalTimeSpent || 0;
        const difference = timeEstimate > 0 
            ? ((totalTimeSpent - timeEstimate) / timeEstimate) * 100 
            : (totalTimeSpent > 0 ? Infinity : 0);
        
        return {
            ...issue,
            mainCategory: getMainCategory(issue),
            timeEstimate: timeEstimate / 3600, // Convert to hours
            totalTimeSpent: totalTimeSpent / 3600, // Convert to hours
            difference
        };
    });

    // Sort issues: first by actual time (descending), then by infinite deviation, then by absolute deviation
    const sortedIssues = issuesWithDeviation.sort((a, b) => {
        // First priority: issues with actual time
        if (a.totalTimeSpent > 0 && b.totalTimeSpent === 0) return -1;
        if (a.totalTimeSpent === 0 && b.totalTimeSpent > 0) return 1;
        
        // Second priority: infinite deviation (no estimate but actual time)
        if (a.difference === Infinity && b.difference !== Infinity) return -1;
        if (a.difference !== Infinity && b.difference === Infinity) return 1;
        
        // Third priority: absolute deviation
        return Math.abs(b.difference) - Math.abs(a.difference);
    });

    // Calculate category comparison data
    const categoryComparison = Object.values(CATEGORIES).map(category => {
        const categoryIssues = issuesWithDeviation.filter(issue => 
            issue.mainCategory === category && issue.totalTimeSpent > 0
        );
        
        const totalEstimated = categoryIssues.reduce((sum, issue) => sum + issue.timeEstimate, 0);
        const totalActual = categoryIssues.reduce((sum, issue) => sum + issue.totalTimeSpent, 0);
        
        return {
            category,
            estimated: totalEstimated,
            actual: totalActual
        };
    });

    // Calculate average deviation per category
    const averageDeviationPerCategory = Object.values(CATEGORIES).map(category => {
        const categoryIssues = issuesWithDeviation.filter(issue => 
            issue.mainCategory === category && 
            issue.totalTimeSpent > 0 && 
            issue.difference !== Infinity
        );
        
        const averageDeviation = categoryIssues.length > 0
            ? categoryIssues.reduce((sum, issue) => sum + Math.abs(issue.difference), 0) / categoryIssues.length
            : 0;
        
        return {
            category,
            averageDeviation
        };
    });

    return (
        <div id="issue-zeitanalyse" className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Issue Zeitanalyse</h2>
            
            {/* Category Comparison Chart */}
            <div className="mb-8">
                <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.TIME_COMPARISON}</h4>
                <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                    <BarChart data={categoryComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, TOOLTIP_LABELS.HOURS]}
                        />
                        <Legend />
                        <Bar dataKey="estimated" fill="#8884d8" name={CHART_LABELS.ESTIMATED_TIME} />
                        <Bar dataKey="actual" fill="#82ca9d" name={CHART_LABELS.ACTUAL_TIME} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Average Deviation per Category */}
            <div className="mb-8">
                <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_LABELS.AVERAGE_DEVIATION}</h4>
                <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.SMALL}>
                    <BarChart data={averageDeviationPerCategory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}%`, TOOLTIP_LABELS.DEVIATION]}
                        />
                        <Bar dataKey="averageDeviation" fill="#ffc658" name="Durchschnittliche Abweichung (%)" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Issues Table */}
            <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Issue Details</h4>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    #
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Issue
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Kategorie
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Geschätzt (h)
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tatsächlich (h)
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Abweichung
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedIssues.map((issue, index) => (
                                <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${issue.totalTimeSpent === 0 ? 'line-through text-gray-400' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {index + 1}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <a 
                                            href={`${GITLAB_CONFIG.ISSUE_BASE_URL}/${issue.iid}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            {issue.title}
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {issue.mainCategory}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {issue.timeEstimate.toFixed(CHART_CONFIG.DECIMAL_PLACES)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {issue.totalTimeSpent.toFixed(CHART_CONFIG.DECIMAL_PLACES)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            issue.timeEstimate === 0 ? 'bg-gray-100 text-gray-800' :
                                            Math.abs(issue.difference) <= DEVIATION_THRESHOLDS.EXCELLENT ? 'bg-green-100 text-green-800' :
                                            Math.abs(issue.difference) <= DEVIATION_THRESHOLDS.GOOD ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        } ${issue.totalTimeSpent === 0 ? 'opacity-50' : ''}`}>
                                            {issue.timeEstimate === 0 ?
                                                (issue.totalTimeSpent > 0 ? '+∞%' : '0%') :
                                                `${issue.difference > 0 ? '+' : ''}${issue.difference.toFixed(CHART_CONFIG.DECIMAL_PLACES)}%`}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default IssueTimeAnalysis; 