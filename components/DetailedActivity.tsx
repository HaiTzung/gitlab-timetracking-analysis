'use client';

import React from "react";
import { Timelog, Issue, ProjectMetrics } from "@/types/dashboard";
import TimeSpentTable from "@/components/TimeSpentTable";
import ActivityFeed from "@/components/ActivityFeed";
import { TimeWindow } from "@/context/DashboardContext";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { addDays, isSameDay, parseISO, format } from "date-fns";
import { de } from "date-fns/locale";
import { useChartColors } from "@/hooks/useChartColors";

interface DetailedActivityProps {
  formatTime: (seconds: number) => string;
  timelogs: Timelog[];
  issues: Issue[];
  timeWindow: TimeWindow;
  customStart: Date | null;
  customEnd: Date | null;
  usernameToName: Record<string, string>;
  projectMetrics: ProjectMetrics;
  COLORS: string[];
  lineData: Array<Record<string, any>>;
  barData: Array<{ name: string; value: number }>;
  TEAM_COLORS: string[];
}

function buildDailyData(
  timelogs: Timelog[],
  weekStart: Date,
  weekEnd: Date,
  barData: Array<{ name: string; value: number }>,
): Array<Record<string, any>> {
  const weekLogs = timelogs.filter(t => {
    const d = parseISO(t.spentAt);
    return d >= weekStart && d <= weekEnd;
  });
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const label = format(day, "EEE dd.MM.", { locale: de });
    const row: Record<string, any> = { week: label };
    barData.forEach(({ name }) => {
      const hours = weekLogs
        .filter(t => t.user.name === name && isSameDay(parseISO(t.spentAt), day))
        .reduce((s, t) => s + t.timeSpent / 3600, 0);
      row[name] = parseFloat(hours.toFixed(2));
    });
    return row;
  });
}

const DetailedActivity: React.FC<DetailedActivityProps> = ({
  timelogs,
  issues,
  timeWindow,
  customStart,
  customEnd,
  usernameToName,
  projectMetrics,
  lineData,
  barData,
  TEAM_COLORS,
}) => {
  const isKwMode = timeWindow === 'kw' && !!customStart && !!customEnd;
  const cc = useChartColors();

  const chartData = isKwMode
    ? buildDailyData(timelogs, customStart!, customEnd!, barData)
    : [...lineData].sort((a, b) => {
        const [weekA, yearA] = a.week.split(' ')[1].split('/');
        const [weekB, yearB] = b.week.split(' ')[1].split('/');
        return (parseInt(yearA) * 100 + parseInt(weekA)) - (parseInt(yearB) * 100 + parseInt(weekB));
      });

  const avgPerPersonPerDay = projectMetrics.averageVelocity / Math.max(barData.length, 1) / 7;
  const avgPerPersonPerWeek = projectMetrics.averageVelocity / Math.max(barData.length, 1);
  return (
    <div id="detaillierte-aktivitat" className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">Aktivität</h2>
      <div className="space-y-10">
        <TimeSpentTable timelogs={timelogs} />

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            {isKwMode ? 'Stunden pro Tag pro Person' : 'Stunden pro Woche pro Person'}
          </h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
              <XAxis
                dataKey="week"
                tickFormatter={isKwMode ? (v) => v : (value) => `KW ${value.split(' ')[1]}`}
                tick={{ fontSize: 11, fill: cc.axis }}
              />
              <YAxis
                label={{ value: 'Stunden', angle: -90, position: 'insideLeft', offset: 10, style: { textAnchor: 'middle' }, fontSize: 11, fill: cc.axis }}
                tick={{ fontSize: 11, fill: cc.axis }}
              />
              <Tooltip
                contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, color: cc.tooltipLabel }}
                labelStyle={{ color: cc.tooltipLabel, fontWeight: 600 }}
                formatter={(value: number, name: string) => [`${value}h`, name]}
                labelFormatter={(value) => isKwMode ? value : `Kalenderwoche ${value.split(' ')[1]}`}
              />
              <Legend />
              {barData.map((entry, index) => {
                const color = TEAM_COLORS[index % TEAM_COLORS.length];
                const activePoints = chartData.filter(d => d[entry.name] != null && d[entry.name] !== 0);
                const showDot = isKwMode || activePoints.length === 1;
                return (
                  <Line
                    key={index}
                    type="monotone"
                    dataKey={entry.name}
                    stroke={color}
                    strokeWidth={3}
                    dot={showDot ? { r: 4, fill: color, strokeWidth: 0 } : false}
                    activeDot={{ r: 5 }}
                    name={entry.name}
                  />
                );
              })}
              <ReferenceLine
                y={isKwMode ? avgPerPersonPerDay : avgPerPersonPerWeek}
                stroke="red"
                strokeDasharray="3 3"
                label={{ value: 'Team Durchschnitt', position: 'right', fill: 'red' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <ActivityFeed
          timelogs={timelogs}
          issues={issues}
          timeWindow={timeWindow}
          customStart={customStart}
          customEnd={customEnd}
          usernameToName={usernameToName}
        />
      </div>
    </div>
  );
};

export default DetailedActivity;
