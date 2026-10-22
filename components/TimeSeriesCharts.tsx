'use client';

import React from 'react';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer, Line, LineChart, Area, AreaChart, ReferenceLine
} from 'recharts';
import { CHART_CONFIG, CHART_TITLES, TOOLTIP_LABELS, CATEGORIES, COLORS } from '../config/dashboardConfig';
import { Issue, ProjectMetrics, Timelog } from '@/types/dashboard';
import {
    format, differenceInDays, eachWeekOfInterval, parseISO, startOfWeek, addDays, isSameDay, endOfWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardContext } from '@/context/DashboardContext';
import { useChartColors } from '@/hooks/useChartColors';

interface TimeSeriesChartsProps {
    projectMetrics: ProjectMetrics;
    lineData: Array<Record<string, any>>;
    barData: Array<{name: string; value: number}>;
    TEAM_COLORS: string[];
    COLORS: string[];
    issues: Issue[];
    timelogs: Timelog[];
}

// ── data builders ─────────────────────────────────────────────────────────────

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

// ── category data builders ────────────────────────────────────────────────────
const CATEGORY_VALUES = Object.values(CATEGORIES) as string[];

function getMainCategory(issue: Issue): string {
    return issue.labels?.nodes?.find(l => CATEGORY_VALUES.includes(l.title))?.title ?? '';
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
        .sort((a, b) => {
            const parse = (s: string) => {
                const parts = s.split(' ');
                const [kw, yr] = parts[1].split('/');
                return Number(yr) * 100 + Number(kw);
            };
            return parse(a[0]) - parse(b[0]);
        })
        .map(([week, values]) => ({ week, ...values }));

    const allCats = [...Object.values(CATEGORIES).map(c => c.replace('category::', '')), 'Sonstige'];
    const categories = allCats.filter(c => data.some(d => (d as Record<string, unknown>)[c]));
    return { data, categories };
}

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

function buildCategoryIssueCount(issues: Issue[]) {
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

function buildDailyTotalData(timelogs: Timelog[], weekStart: Date, weekEnd: Date) {
    const weekLogs = timelogs.filter(t => {
        const d = parseISO(t.spentAt);
        return d >= weekStart && d <= weekEnd;
    });
    return Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        const label = format(day, 'EEE dd.MM.', { locale: de });
        const totalHours = weekLogs
            .filter(t => isSameDay(parseISO(t.spentAt), day))
            .reduce((s, t) => s + t.timeSpent / 3600, 0);
        return { day: label, totalHours: parseFloat(totalHours.toFixed(2)) };
    });
}

function buildDailyCategoryData(timelogs: Timelog[], weekStart: Date, weekEnd: Date) {
    const weekLogs = timelogs.filter(t => {
        const d = parseISO(t.spentAt);
        return d >= weekStart && d <= weekEnd;
    });
    return Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        const label = format(day, 'EEE dd.MM.', { locale: de });
        const categoryHours: Record<string, number> = {};
        CATEGORY_VALUES.forEach(cat => {
            categoryHours[cat] = weekLogs
                .filter(t => {
                    const d = parseISO(t.spentAt);
                    return isSameDay(d, day) &&
                        t.issue?.labels?.nodes?.some(l => l.title === cat);
                })
                .reduce((s, t) => s + t.timeSpent / 3600, 0);
        });
        return { day: label, categoryHours };
    });
}

// ── component ─────────────────────────────────────────────────────────────────

const TimeSeriesCharts: React.FC<TimeSeriesChartsProps> = ({
    projectMetrics,
    lineData,
    barData,
    TEAM_COLORS,
    issues,
    timelogs,
}) => {
    const ctx = useDashboardContext();
    const cc = useChartColors();
    const isKwMode = ctx?.timeWindow === 'kw' && !!ctx.customStart && !!ctx.customEnd;

    const spentByCategory = buildSpentByCategory(timelogs);
    const burndown        = buildBurndown(issues);
    const cycleTime       = buildCycleTime(issues);
    const catIssueCounts  = buildCategoryIssueCount(issues);
    const weeklyVolume    = buildWeeklyIssueVolume(issues);

    const dailyCategoryData = isKwMode
        ? buildDailyCategoryData(timelogs, ctx!.customStart!, ctx!.customEnd!)
        : [];
    const dailyTotalData = isKwMode
        ? buildDailyTotalData(timelogs, ctx!.customStart!, ctx!.customEnd!)
        : [];

    return (
        <div id="zeitliche-entwicklung" className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">Zeitliche Entwicklung</h2>
            <div className="grid grid-cols-1 gap-10">

                {/* Kategorie-Trend */}
                {(isKwMode || projectMetrics.sprintData.length > 0) && (
                <section>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                        {isKwMode ? 'Kategorie-Trend (täglich)' : 'Kategorie-Trend'}
                    </h3>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
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
                            {CATEGORY_VALUES.map((category) => {
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
                </section>
                )}

                {/* Gebuchte Stunden pro Kategorie (wöchentlich) */}
                {false && spentByCategory.data.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Gebuchte Stunden pro Kategorie (wöchentlich)</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Aufwand pro Kategorie über Zeit — gestapelt</p>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={spentByCategory.data}>
                                <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                                <XAxis dataKey="week" tick={{ fontSize: 11, fill: cc.axis }} />
                                <YAxis unit="h" tick={{ fontSize: 11, fill: cc.axis }} />
                                <Tooltip
                                    contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                    labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                    formatter={(v: number, name: string) => [`${v.toFixed(1)}h`, name]}
                                />
                                <Legend />
                                {spentByCategory.categories.map(cat => {
                                    const fullKey = `category::${cat}` as keyof typeof COLORS.CATEGORY;
                                    const color = COLORS.CATEGORY[fullKey] ?? '#94a3b8';
                                    return <Bar key={cat} dataKey={cat} stackId="a" fill={color} name={cat} />;
                                })}
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* Neue vs. geschlossene Issues pro Woche */}
                {weeklyVolume.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Neue vs. geschlossene Issues pro Woche</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Nicht kumulativ — zeigt Aktivität pro Kalenderwoche</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={weeklyVolume}>
                                <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                                <XAxis dataKey="week" tick={{ fontSize: 11, fill: cc.axis }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: cc.axis }} label={{ value: 'Issues', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                    labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                    formatter={(v: number, name: string) => [v, name === 'opened' ? 'Geöffnet' : 'Geschlossen']}
                                />
                                <Legend formatter={n => n === 'opened' ? 'Geöffnet' : 'Geschlossen'} />
                                <Bar dataKey="opened" fill="#ef4444" name="opened" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="closed" fill="#22c55e" name="closed" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* Burndown */}
                {burndown.length > 1 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Burndown — kumulativer Verlauf</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Gesamtzahl geöffneter und geschlossener Issues über Zeit</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={burndown}>
                                <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                                <XAxis dataKey="week" tick={{ fontSize: 11, fill: cc.axis }} />
                                <YAxis tick={{ fontSize: 11, fill: cc.axis }} label={{ value: 'Issues', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                    labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                    formatter={(v: number, n: string) => [v, n === 'opened' ? 'Geöffnet' : 'Geschlossen']}
                                />
                                <Legend formatter={n => n === 'opened' ? 'Geöffnet' : 'Geschlossen'} />
                                <Line type="monotone" dataKey="opened" stroke="#ef4444" strokeWidth={2} dot={false} name="opened" />
                                <Line type="monotone" dataKey="closed" stroke="#22c55e" strokeWidth={2} dot={false} name="closed" />
                            </LineChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* Team Activity Comparison */}
                {false && (
                <section>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{CHART_TITLES.TEAM_ACTIVITY_COMPARISON}</h3>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.SMALL}>
                        <BarChart data={projectMetrics.sprintData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                            <XAxis dataKey="sprintStart" tick={{ fontSize: 11, fill: cc.axis }} />
                            <YAxis tick={{ fontSize: 11, fill: cc.axis }} label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                labelFormatter={(value) => `Sprint ${value}`}
                                formatter={(value: number, name: string) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, name]}
                            />
                            <Legend />
                            {Object.keys(projectMetrics.sprintData[0]?.userHours || {}).map((user, index) => (
                                <Bar
                                    key={user}
                                    dataKey={`userHours.${user}`}
                                    name={user}
                                    stackId="a"
                                    fill={TEAM_COLORS[index % TEAM_COLORS.length]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </section>
                )}

                {/* Velocity Chart */}
                <section>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                        {isKwMode ? 'Tägliche Leistung' : CHART_TITLES.WEEKLY_PERFORMANCE}
                    </h3>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.SMALL}>
                        {isKwMode ? (
                        <BarChart data={dailyTotalData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: cc.axis }} />
                            <YAxis tick={{ fontSize: 11, fill: cc.axis }} label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }} labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }} formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, TOOLTIP_LABELS.HOURS_PER_WEEK]} />
                            <Bar dataKey="totalHours" fill="#3b82f6" name={TOOLTIP_LABELS.HOURS_PER_WEEK} />
                            <ReferenceLine
                                y={projectMetrics.averageVelocity / 7}
                                stroke="red"
                                label={{ value: 'Durchschnitt', position: 'right' }}
                            />
                        </BarChart>
                        ) : (
                        <BarChart data={projectMetrics.sprintData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                            <XAxis dataKey="sprintStart" tick={{ fontSize: 11, fill: cc.axis }} />
                            <YAxis tick={{ fontSize: 11, fill: cc.axis }} label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }} labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }} formatter={(value: number, name: string) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, name]} />
                            <Bar dataKey="totalHours" fill="#3b82f6" name={TOOLTIP_LABELS.HOURS_PER_WEEK} />
                            <ReferenceLine
                                y={projectMetrics.averageVelocity}
                                stroke="red"
                                label={{ value: 'Durchschnitt', position: 'right' }}
                            />
                        </BarChart>
                        )}
                    </ResponsiveContainer>
                </section>

                {/* Cumulative Progress */}
                <section>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{CHART_TITLES.CUMULATIVE_PROGRESS}</h3>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.SMALL}>
                        {isKwMode ? (
                        <AreaChart data={dailyTotalData.map((d, i, arr) => ({
                            day: d.day,
                            cumulativeHours: arr.slice(0, i + 1).reduce((s, x) => s + x.totalHours, 0),
                        }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: cc.axis }} />
                            <YAxis tick={{ fontSize: 11, fill: cc.axis }} label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }} labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, TOOLTIP_LABELS.TOTAL_HOURS]}
                            />
                            <Area type="monotone" dataKey="cumulativeHours" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} name="Kumulierte Stunden" />
                        </AreaChart>
                        ) : (
                        <AreaChart data={projectMetrics.sprintData.map((sprint, index, array) => ({
                            kw: sprint.sprintStart,
                            cumulativeHours: array.slice(0, index + 1).reduce((sum, s) => sum + s.totalHours, 0),
                        }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                            <XAxis dataKey="kw" tick={{ fontSize: 11, fill: cc.axis }} />
                            <YAxis tick={{ fontSize: 11, fill: cc.axis }} label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }} labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, TOOLTIP_LABELS.TOTAL_HOURS]}
                            />
                            <Area type="monotone" dataKey="cumulativeHours" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} name="Kumulierte Stunden" />
                        </AreaChart>
                        )}
                    </ResponsiveContainer>
                </section>

                {/* Ø Bearbeitungszeit pro Kategorie */}
                {cycleTime.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Ø Bearbeitungszeit pro Kategorie</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Tage von Erstellung bis Schließung — nur geschlossene Issues</p>
                        <ResponsiveContainer width="100%" height={Math.max(160, cycleTime.length * 44)}>
                            <BarChart data={cycleTime} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                                <XAxis type="number" unit=" Tage" tick={{ fontSize: 11, fill: cc.axis }} />
                                <YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 11, fill: cc.axis }} />
                                <Tooltip
                                    contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                    labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                    formatter={(v: number, _: string, p: any) => [`${v} Tage (${p.payload.count} Issues)`, 'Ø Bearbeitungszeit']}
                                />
                                <Bar dataKey="avgDays" fill="#6366f1" name="Ø Tage" radius={[0, 3, 3, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

            </div>
        </div>
    );
};

export default TimeSeriesCharts;
