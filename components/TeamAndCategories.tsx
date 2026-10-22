import React from 'react';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer,
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { CHART_CONFIG, CHART_TITLES, CATEGORIES, COLORS as CONFIG_COLORS } from '../config/dashboardConfig';
import { Timelog } from '@/types/dashboard';
import { useDashboardContext } from '@/context/DashboardContext';
import { useChartColors } from '@/hooks/useChartColors';

const CATEGORY_KEYS = Object.values(CATEGORIES) as string[];
const CAT_LABELS: Record<string, string> = {
    'category::requirements':      'Req.',
    'category::architecture':      'Entwurf',
    'category::implementation':    'Impl.',
    'category::project-management':'PM',
};
const RADAR_COLOR = '#6366f1';

// Wraps a label string into at most two lines at the nearest space before maxLen.
function wrapLabel(text: string, maxLen = 10): [string, string] {
    if (text.length <= maxLen) return [text, ''];
    const cut = text.lastIndexOf(' ', maxLen);
    if (cut > 0) return [text.slice(0, cut), text.slice(cut + 1)];
    return [text.slice(0, maxLen), text.slice(maxLen)];
}

// Custom tick that renders two-line SVG text, positioned correctly around the chart.
function RadarTick({ x, y, payload, cx, cy, axisColor = '#6b7280' }: any) {
    const [line1, line2] = wrapLabel(payload.value);
    const dx = x - cx;
    const dy = y - cy;
    const anchor = Math.abs(dx) < 5 ? 'middle' : dx > 0 ? 'start' : 'end';
    return (
        <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontSize={9} fill={axisColor}>
            <tspan x={x} dy={line2 ? '-0.6em' : '0'}>{line1}</tspan>
            {line2 && <tspan x={x} dy="1.2em">{line2}</tspan>}
        </text>
    );
}

interface TeamAndCategoriesProps {
    pieData: Array<{ name: string; value: number }>;
    barData: Array<{ name: string; value: number }>;
    COLORS: string[];
    userLastLogged: Record<string, string | null>;
    teamMembers: string[];
    selectedCategory: string | null;
    onCategorySelect: (category: string | null) => void;
    timelogs: Timelog[];
    allTimelogs: Timelog[];
    usernameToName: Record<string, string>;
}

function buildRadarData(timelogs: Timelog[], username: string) {
    const hours: Record<string, number> = {};
    timelogs.forEach(log => {
        if (log.user.username !== username) return;
        const cat = log.issue?.labels?.nodes?.find(l => CATEGORY_KEYS.includes(l.title))?.title ?? '';
        if (!cat) return;
        hours[cat] = (hours[cat] ?? 0) + log.timeSpent / 3600;
    });
    return CATEGORY_KEYS.map(cat => ({
        category: CAT_LABELS[cat] ?? cat,
        hours: parseFloat((hours[cat] ?? 0).toFixed(1)),
    }));
}

function buildCategoryRadarData(timelogs: Timelog[], categoryKey: string, teamMembers: string[], usernameToName: Record<string, string>) {
    const hours: Record<string, number> = {};
    timelogs.forEach(log => {
        const cat = log.issue?.labels?.nodes?.find(l => CATEGORY_KEYS.includes(l.title))?.title ?? '';
        if (cat !== categoryKey) return;
        hours[log.user.username] = (hours[log.user.username] ?? 0) + log.timeSpent / 3600;
    });
    return teamMembers.map(username => ({
        member: usernameToName[username] ?? username,
        hours: parseFloat((hours[username] ?? 0).toFixed(1)),
    }));
}

const TeamAndCategories: React.FC<TeamAndCategoriesProps> = ({
    pieData, barData, COLORS, userLastLogged, teamMembers,
    selectedCategory, onCategorySelect, timelogs, allTimelogs, usernameToName,
}) => {
    const ctx = useDashboardContext();
    const isAllMode = !ctx?.timeWindow || ctx.timeWindow === 'all';
    const cc = useChartColors();

    const formatLastLogged = (iso: string | null) => {
        if (!iso) return 'Noch keine Buchung';
        const d = new Date(iso);
        const days = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (days === 0) return 'Heute';
        if (days === 1) return 'Gestern';
        return `vor ${days} Tagen`;
    };

    // Per-username booking counts
    const windowCountByUsername: Record<string, number> = {};
    timelogs.forEach(t => {
        windowCountByUsername[t.user.username] = (windowCountByUsername[t.user.username] ?? 0) + 1;
    });
    const totalCountByUsername: Record<string, number> = {};
    allTimelogs.forEach(t => {
        totalCountByUsername[t.user.username] = (totalCountByUsername[t.user.username] ?? 0) + 1;
    });

    // Last booking per username from full timelogs
    const lastLoggedAll: Record<string, string | null> = {};
    teamMembers.forEach(u => {
        const logs = allTimelogs.filter(t => t.user.username === u);
        lastLoggedAll[u] = logs.length
            ? logs.reduce((a, b) => a.spentAt > b.spentAt ? a : b).spentAt
            : null;
    });

    const maxHours = Math.max(
        ...teamMembers.flatMap(u => buildRadarData(timelogs, u).map(d => d.hours)),
        1,
    );

    const maxHoursPerCategory = Math.max(
        ...CATEGORY_KEYS.flatMap(cat => buildCategoryRadarData(timelogs, cat, teamMembers, usernameToName).map(d => d.hours)),
        1,
    );

    return (
        <div id="team-kategorien" className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Team & Kategorien</h2>
                {selectedCategory && (
                    <button
                        onClick={() => onCategorySelect(null)}
                        className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                        {selectedCategory} ✕
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 gap-6">
                {/* Category Distribution pie */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        {CHART_TITLES.CATEGORY_DISTRIBUTION}
                    </h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                        <PieChart>
                            <Pie
                                dataKey="value"
                                data={pieData}
                                outerRadius={100}
                                label={({ name, value }) => value !== undefined ? `${name}\n${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h` : name}
                            >
                                {pieData.map((entry) => (
                                    <Cell
                                        key={`cell-${entry.name}`}
                                        fill={CONFIG_COLORS.CATEGORY[entry.name as keyof typeof CONFIG_COLORS.CATEGORY] ?? '#94a3b8'}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                formatter={(value: number, name: string) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, name]}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Radar charts — one per category, team members as corners */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Teammitglieder pro Kategorie</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Stunden pro Person je Kategorie — gemeinsame Skala</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {CATEGORY_KEYS.map(catKey => {
                            const data = buildCategoryRadarData(timelogs, catKey, teamMembers, usernameToName);
                            const total = data.reduce((s, d) => s + d.hours, 0);
                            return (
                                <div key={catKey} className="flex flex-col items-center">
                                    <RadarChart
                                        width={220}
                                        height={200}
                                        data={data}
                                        margin={{ top: 24, right: 48, bottom: 24, left: 48 }}
                                    >
                                        <PolarGrid stroke={cc.grid} />
                                        <PolarAngleAxis
                                            dataKey="member"
                                            tick={(props) => <RadarTick {...props} axisColor={cc.axis} />}
                                        />
                                        <Radar
                                            dataKey="hours"
                                            stroke={RADAR_COLOR}
                                            fill={RADAR_COLOR}
                                            fillOpacity={0.25}
                                            strokeWidth={1.5}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                            formatter={(v: number) => [`${v}h`, 'Stunden']}
                                            labelStyle={{ fontSize: 11, color: cc.tooltipLabel }}
                                        />
                                    </RadarChart>
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 text-center leading-tight mt-1">{CAT_LABELS[catKey] ?? catKey}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">{total.toFixed(1)}h gesamt</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Radar charts — one per team member */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Kategorienverteilung pro Teammitglied</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Stunden pro Kategorie — gemeinsame Skala</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {teamMembers.map(username => {
                            const displayName = usernameToName[username] ?? username;
                            const data = buildRadarData(timelogs, username);
                            const total = data.reduce((s, d) => s + d.hours, 0);
                            return (
                                <div key={username} className="flex flex-col items-center">
                                    <RadarChart
                                        width={220}
                                        height={200}
                                        data={data}
                                        margin={{ top: 24, right: 48, bottom: 24, left: 48 }}
                                    >
                                        <PolarGrid stroke={cc.grid} />
                                        <PolarAngleAxis
                                            dataKey="category"
                                            tick={(props) => <RadarTick {...props} axisColor={cc.axis} />}
                                        />
                                        <Radar
                                            dataKey="hours"
                                            stroke={RADAR_COLOR}
                                            fill={RADAR_COLOR}
                                            fillOpacity={0.25}
                                            strokeWidth={1.5}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                            formatter={(v: number) => [`${v}h`, 'Stunden']}
                                            labelStyle={{ fontSize: 11, color: cc.tooltipLabel }}
                                        />
                                    </RadarChart>
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 text-center leading-tight mt-1">{displayName}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">{total.toFixed(1)}h gesamt</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Team Activity + Last logged — side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Team Activity */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{CHART_TITLES.TEAM_ACTIVITY}</h4>
                        <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: cc.axis }} />
                                <YAxis label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11 }} tick={{ fontSize: 11, fill: cc.axis }} />
                                <Tooltip
                                    contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                                    labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                                    formatter={(value: number, name: string) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, name]}
                                />
                                <Legend />
                                <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Per-user last logged */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Letzte Buchung pro Teammitglied</h4>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                            {teamMembers.map(username => {
                                const windowCount = windowCountByUsername[username] ?? 0;
                                const totalCount = totalCountByUsername[username] ?? 0;
                                const displayName = usernameToName[username] ?? username;
                                const hasWindowActivity = windowCount > 0;
                                return (
                                    <div
                                        key={username}
                                        className="grid px-4 py-2 gap-x-4 items-center"
                                        style={{ gridTemplateColumns: isAllMode ? '1fr 7rem 7rem' : '1fr 3rem 5rem' }}
                                    >
                                        <span className={`font-medium truncate ${hasWindowActivity ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                                            {displayName}
                                        </span>
                                        {isAllMode ? (
                                            <>
                                                <span className={`tabular-nums text-right text-xs ${hasWindowActivity ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {totalCount} Buchungen
                                                </span>
                                                <span className={`text-right text-xs ${hasWindowActivity ? 'text-gray-500 dark:text-gray-400' : 'text-red-400 font-semibold'}`}>
                                                    {formatLastLogged(lastLoggedAll[username] ?? null)}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`tabular-nums text-right text-xs font-semibold ${hasWindowActivity ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {windowCount}
                                                </span>
                                                <span className={`text-right text-xs ${hasWindowActivity ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>Buchungen</span>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamAndCategories;
