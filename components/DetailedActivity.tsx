'use client';

import React from "react";
import { Timelog, Issue, ProjectMetrics } from "@/types/dashboard";
import TimeSpentTable from "@/components/TimeSpentTable";
import ActivityFeed from "@/components/ActivityFeed";
import { TimeWindow } from "@/context/DashboardContext";
import { COLORS as CONFIG_COLORS } from "@/config/dashboardConfig";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
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
}

const DetailedActivity: React.FC<DetailedActivityProps> = ({
  timelogs,
  issues,
  timeWindow,
  customStart,
  customEnd,
  usernameToName,
  projectMetrics,
}) => {
  return (
    <div id="detaillierte-aktivitat" className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-6 text-gray-800">Aktivität</h2>
      <div className="space-y-10">
        {/* Time spent per person per category */}
        <TimeSpentTable timelogs={timelogs} />

        {/* Category Trend */}
        {projectMetrics.sprintData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Kategorie-Trend</h4>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={projectMetrics.sprintData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sprintStart" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelStyle={{ color: '#111827', fontWeight: 600 }}
                  labelFormatter={(value) => `Sprint ${value}`}
                  formatter={(value: number, name: string) => [`${(value as number).toFixed(1)}h`, name]}
                />
                <Legend />
                {Object.keys(projectMetrics.sprintData[0]?.categoryHours || {}).map((category) => {
                  const color = CONFIG_COLORS.CATEGORY[category as keyof typeof CONFIG_COLORS.CATEGORY] ?? '#94a3b8';
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
            </ResponsiveContainer>
          </div>
        )}

        {/* Activity history feed */}
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
