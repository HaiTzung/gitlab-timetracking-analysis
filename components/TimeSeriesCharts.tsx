'use client';

import React from 'react';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer, Line, LineChart, Area, AreaChart, ReferenceLine
} from 'recharts';
import { CHART_CONFIG, CHART_TITLES, TOOLTIP_LABELS } from '../config/dashboardConfig';
import { ProjectMetrics } from '@/types/dashboard';

interface TimeSeriesChartsProps {
    projectMetrics: ProjectMetrics;
    lineData: Array<Record<string, any>>;
    barData: Array<{name: string; value: number}>;
    TEAM_COLORS: string[];
    COLORS: string[];
}

const TimeSeriesCharts: React.FC<TimeSeriesChartsProps> = ({
    projectMetrics,
    lineData,
    barData,
    TEAM_COLORS,
    COLORS
}) => {
    return (
        <div id="zeitliche-entwicklung" className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Zeitliche Entwicklung</h2>
            <div className="grid grid-cols-1 gap-6">
                {/* Cumulative Progress */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.CUMULATIVE_PROGRESS}</h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.SMALL}>
                        <AreaChart data={projectMetrics.sprintData.map((sprint, index, array) => ({
                            sprint: `Sprint ${index + 1}`,
                            cumulativeHours: array
                                .slice(0, index + 1)
                                .reduce((sum, s) => sum + s.totalHours, 0)
                        }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="sprint" />
                            <YAxis />
                            <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }}
                                formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, TOOLTIP_LABELS.TOTAL_HOURS]}
                            />
                            <Area
                                type="monotone"
                                dataKey="cumulativeHours"
                                stroke="#8884d8"
                                fill="#8884d8"
                                fillOpacity={0.3}
                                name="Kumulierte Stunden"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Team Activity Comparison */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.TEAM_ACTIVITY_COMPARISON}</h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.SMALL}>
                        <BarChart data={projectMetrics.sprintData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="sprintStart" />
                            <YAxis />
                            <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }}
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
                </div>

                {/* Velocity Chart */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.WEEKLY_PERFORMANCE}</h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.SMALL}>
                        <BarChart data={projectMetrics.sprintData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="sprintStart" />
                            <YAxis />
                            <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }} formatter={(value: number, name: string) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, name]} />
                            <Bar dataKey="totalHours" fill="#3b82f6" name={TOOLTIP_LABELS.HOURS_PER_WEEK} />
                            <ReferenceLine
                                y={projectMetrics.averageVelocity}
                                stroke="red"
                                label={{ value: 'Durchschnitt', position: 'right' }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Line Chart - Hours per Week per Person */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.HOURS_PER_WEEK_PER_PERSON}</h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                        <LineChart data={(() => {
                            return [...lineData].sort((a, b) => {
                                const [weekA, yearA] = a.week.split(' ')[1].split('/');
                                const [weekB, yearB] = b.week.split(' ')[1].split('/');
                                return (parseInt(yearA) * 100 + parseInt(weekA)) - (parseInt(yearB) * 100 + parseInt(weekB));
                            });
                        })()}>
                            <XAxis
                                dataKey="week"
                                tickFormatter={(value) => `KW ${value.split(' ')[1]}`}
                            />
                            <YAxis
                                label={{ value: TOOLTIP_LABELS.HOURS, angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }}
                                formatter={(value: number, name: string) => [`${value}h`, name]}
                                labelFormatter={(value) => `Kalenderwoche ${value.split(' ')[1]}`}
                            />
                            <Legend />
                            {barData.map((entry, index) => {
                                const color = TEAM_COLORS[index % TEAM_COLORS.length];
                                const userPoints = lineData.filter(d => d[entry.name] != null && d[entry.name] !== 0);
                                const isSinglePoint = userPoints.length === 1;
                                return (
                                    <Line
                                        key={index}
                                        type="monotone"
                                        dataKey={entry.name}
                                        stroke={color}
                                        strokeWidth={3}
                                        dot={isSinglePoint ? { r: 5, fill: color, strokeWidth: 0 } : false}
                                        activeDot={{ r: 5 }}
                                        name={entry.name}
                                    />
                                );
                            })}
                            <ReferenceLine
                                y={projectMetrics.averageVelocity / barData.length}
                                stroke="red"
                                strokeDasharray="3 3"
                                label={{
                                    value: 'Team Durchschnitt',
                                    position: 'right',
                                    fill: 'red'
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default TimeSeriesCharts;
