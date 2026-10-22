'use client';

import React from 'react';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts';
import { CHART_CONFIG, CHART_TITLES, CHART_LABELS, CATEGORIES, COLORS as CONFIG_COLORS } from '@/config/dashboardConfig';
import { Issue, IssueComplexityData } from '@/types/dashboard';
import { differenceInDays, parseISO } from 'date-fns';
import { useChartColors } from '@/hooks/useChartColors';

interface IssueAnalysisProps {
    issueComplexityData: IssueComplexityData[];
    COLORS: string[];
    issues: Issue[];
}

const CATEGORY_VALUES = Object.values(CATEGORIES) as string[];

function getMainCategory(issue: Issue): string {
    return issue.labels?.nodes?.find(l => CATEGORY_VALUES.includes(l.title))?.title ?? '';
}

function buildCategoryComparison(issues: Issue[]) {
    const issuesWithTime = issues.map(issue => ({
        ...issue,
        mainCategory: getMainCategory(issue),
        estimatedH: (issue.timeEstimate || 0) / 3600,
        spentH: (issue.totalTimeSpent || 0) / 3600,
    })).filter(i => i.mainCategory && (i.estimatedH > 0 || i.spentH > 0));

    return CATEGORY_VALUES.map(cat => {
        const catIssues = issuesWithTime.filter(i => i.mainCategory === cat && i.spentH > 0);
        return {
            category: cat.replace('category::', ''),
            estimated: catIssues.reduce((s, i) => s + i.estimatedH, 0),
            actual: catIssues.reduce((s, i) => s + i.spentH, 0),
        };
    }).filter(c => c.estimated > 0 || c.actual > 0);
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
        { label: '< 1 Tag',    count: 0 },
        { label: '1–3 Tage',   count: 0 },
        { label: '4–7 Tage',   count: 0 },
        { label: '7–14 Tage',  count: 0 },
        { label: '15–21 Tage', count: 0 },
        { label: '22–31 Tage', count: 0 },
        { label: '> 31 Tage',  count: 0 },
    ];
    open.forEach(i => {
        const age = differenceInDays(new Date(), parseISO(i.createdAt));
        if (age < 1)        buckets[0].count++;
        else if (age <= 3)  buckets[1].count++;
        else if (age <= 7)  buckets[2].count++;
        else if (age <= 14) buckets[3].count++;
        else if (age <= 21) buckets[4].count++;
        else if (age <= 31) buckets[5].count++;
        else                buckets[6].count++;
    });
    return buckets;
}

const IssueAnalysis: React.FC<IssueAnalysisProps> = ({ issueComplexityData, COLORS, issues }) => {
    const categoryComparison = buildCategoryComparison(issues);
    const scatter = buildScatter(issues);
    const aging = buildAging(issues);
    const maxScatter = Math.max(...scatter.map(d => Math.max(d.estimated, d.actual)), 1);
    const cc = useChartColors();

    return (
        <div id="issue-analyse" className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">Issue Analyse</h2>
            <div className="grid grid-cols-1 gap-6">

                {/* Geschätzt vs. Gebucht pro Kategorie */}
                {false && categoryComparison.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Geschätzt vs. Gebucht pro Kategorie</h4>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={categoryComparison}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="category" />
                                <YAxis />
                                <Tooltip labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                    formatter={(value: number, name: string) => [`${value.toFixed(1)}h`, name]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Issue Complexity */}
                {false && (
                <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{CHART_TITLES.ISSUE_COMPLEXITY}</h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                        <BarChart data={issueComplexityData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="category"
                                interval={0}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                label={{
                                    value: 'Durchschnittliche Zeit (Stunden)',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { textAnchor: 'middle' }
                                }}
                            />
                            <Tooltip labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                formatter={(value: number, name: string) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, name]}
                                labelFormatter={(label) => `${label}`}
                            />
                            <Legend />
                            <Bar
                                dataKey="averageTime"
                                fill="#82ca9d"
                                name={CHART_LABELS.AVERAGE_TIME_PER_ISSUE}
                            >
                                {issueComplexityData.map((entry) => (
                                    <Cell
                                        key={`cell-${entry.category}`}
                                        fill={CONFIG_COLORS.CATEGORY[entry.category as keyof typeof CONFIG_COLORS.CATEGORY] ?? '#94a3b8'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                )}

                {/* Offene Issues nach Alter */}
                {aging.some(b => b.count > 0) && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Offene Issues nach Alter</h4>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Wie lange sind offene Issues bereits offen?</p>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={aging}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Anzahl Issues', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#6b7280' }} />
                                <Tooltip
                                    labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                    formatter={(v: number) => [v, 'Issues']}
                                />
                                <Bar dataKey="count" name="Issues" radius={[4, 4, 0, 0]}>
                                    {aging.map((_, i) => (
                                        <Cell key={i} fill={['#22c55e', '#86efac', '#fde047', '#f59e0b', '#fb923c', '#ef4444', '#b91c1c'][i]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Schätzgenauigkeit scatter */}
                {scatter.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Schätzgenauigkeit — Geschätzt vs. Tatsächlich</h4>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Punkte auf der Linie = perfekte Schätzung · darüber = Überschreitung · darunter = Unterschreitung</p>
                        <ResponsiveContainer width="100%" height={280}>
                            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" dataKey="estimated" name="Geschätzt" unit="h" domain={[0, Math.ceil(maxScatter * 1.1)]} tick={{ fontSize: 11 }} label={{ value: 'Geschätzt (h)', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#6b7280' }} />
                                <YAxis type="number" dataKey="actual" name="Tatsächlich" unit="h" domain={[0, Math.ceil(maxScatter * 1.1)]} tick={{ fontSize: 11 }} label={{ value: 'Tatsächlich (h)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#6b7280' }} />
                                <ZAxis range={[40, 40]} />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                                    content={({ payload }) => {
                                        if (!payload?.length) return null;
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-2 text-xs shadow">
                                                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">#{d.iid} {d.title}</p>
                                                <p className="text-gray-900 dark:text-gray-100">Geschätzt: {d.estimated}h</p>
                                                <p className="text-gray-900 dark:text-gray-100">Tatsächlich: {d.actual}h</p>
                                            </div>
                                        );
                                    }}
                                />
                                <ReferenceLine
                                    segment={[{ x: 0, y: 0 }, { x: maxScatter, y: maxScatter }]}
                                    stroke="#94a3b8" strokeDasharray="4 4"
                                    label={{ value: 'Perfekt', position: 'insideTopLeft', fontSize: 11, fill: '#94a3b8' }}
                                />
                                <Scatter data={scatter} fill="#3b82f6" fillOpacity={0.7} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                )}

            </div>
        </div>
    );
};

export default IssueAnalysis;
