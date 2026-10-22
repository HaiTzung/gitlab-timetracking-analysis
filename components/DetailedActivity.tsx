'use client';

import React from "react";
import { Timelog, Issue, ProjectMetrics } from "@/types/dashboard";
import TimeSpentTable from "@/components/TimeSpentTable";
import ActivityFeed from "@/components/ActivityFeed";
import { TimeWindow } from "@/context/DashboardContext";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

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
  return (
    <div id="detaillierte-aktivitat" className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-6 text-gray-800">Aktivität</h2>
      <div className="space-y-10">
        <TimeSpentTable timelogs={timelogs} />

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Stunden pro Woche pro Person</h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={(() => {
              return [...lineData].sort((a, b) => {
                const [weekA, yearA] = a.week.split(' ')[1].split('/');
                const [weekB, yearB] = b.week.split(' ')[1].split('/');
                return (parseInt(yearA) * 100 + parseInt(weekA)) - (parseInt(yearB) * 100 + parseInt(weekB));
              });
            })()}>
              <XAxis dataKey="week" tickFormatter={(value) => `KW ${value.split(' ')[1]}`} tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'h', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 11 }} />
              <Tooltip
                labelStyle={{ color: '#111827', fontWeight: 600 }}
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
