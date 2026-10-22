import React from "react";
import { CHART_TITLES } from "@/config/dashboardConfig";
import { HeatmapData, Timelog, Issue } from "@/types/dashboard";
import TimeSpentTable from "@/components/TimeSpentTable";
import ActivityFeed from "@/components/ActivityFeed";
import { TimeWindow } from "@/context/DashboardContext";

interface DetailedActivityProps {
  heatmapData: HeatmapData[][];
  HEATMAP_COLORS: string[];
  formatTime: (seconds: number) => string;
  timelogs: Timelog[];
  issues: Issue[];
  timeWindow: TimeWindow;
  customStart: Date | null;
  customEnd: Date | null;
  usernameToName: Record<string, string>;
}

const DetailedActivity: React.FC<DetailedActivityProps> = ({
  heatmapData,
  HEATMAP_COLORS,
  formatTime,
  timelogs,
  issues,
  timeWindow,
  customStart,
  customEnd,
  usernameToName,
}) => {
  const getColorIndex = (value: number) => {
    if (value === 0) return 0;
    if (value < 3600) return 1; // < 1 hour
    if (value < 7200) return 2; // < 2 hours
    if (value < 14400) return 3; // < 4 hours
    return 4; // >= 4 hours
  };

  return (
    <div id="detaillierte-aktivitat" className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-6 text-gray-800">Aktivität</h2>
      <div className="space-y-10">
        {/* Time spent per person per category */}
        <TimeSpentTable timelogs={timelogs} />

        {/* GitHub-style Activity Heatmap */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-4">{CHART_TITLES.DAILY_ACTIVITY}</h4>
          <div className="w-full">
            <div className="w-full">
              {/* Month label row */}
              <div className="flex items-start space-x-2 mb-0">
                <div className="w-8 shrink-0"></div>
                <div className="flex-1 flex space-x-1">
                  {heatmapData.map((week, weekIndex) => {
                    const firstDay = week.find(d => d.date);
                    const isMonthStart =
                      weekIndex === 0 ||
                      (firstDay && new Date(firstDay.date).getDate() <= 7);
                    const label = isMonthStart && firstDay
                      ? new Date(firstDay.date).toLocaleDateString("de-DE", { month: "short" })
                      : "";
                    return (
                      <div key={weekIndex} className="flex-1 min-w-0">
                        <span className="block text-xs text-gray-500 truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day-of-month row — shows the date number at the start of each week */}
              <div className="flex items-start space-x-2 mb-1">
                <div className="w-8 shrink-0"></div>
                <div className="flex-1 flex space-x-1">
                  {heatmapData.map((week, weekIndex) => {
                    const firstDay = week.find(d => d.date);
                    const dayNum = firstDay ? new Date(firstDay.date).getDate() : "";
                    return (
                      <div key={weekIndex} className="flex-1 min-w-0">
                        <span className="block text-xs text-gray-400 truncate">{dayNum}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Main heatmap grid */}
              <div className="flex items-start space-x-2">
                {/* Day labels on the left */}
                <div className="flex flex-col space-y-1 mr-2 w-8 shrink-0">
                  {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((day) => (
                    <div key={day} className="h-4 text-xs text-gray-500 leading-4">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Contribution squares */}
                <div className="flex-1 flex space-x-1">
                  {heatmapData.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex-1 flex flex-col space-y-1">
                      {week.map((day, dayIndex) => (
                        <div
                          key={dayIndex}
                          className="w-full h-4 rounded-sm border border-gray-100"
                          style={{
                            backgroundColor: HEATMAP_COLORS[getColorIndex(day.value)],
                          }}
                          title={day.date ? new Date(day.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + (day.value > 0 ? `: ${formatTime(day.value)}` : "") : ""}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* GitHub-style legend */}
              <div className="mt-4 flex items-center justify-end space-x-1">
                <span className="text-xs text-gray-500 mr-2">Weniger</span>
                {HEATMAP_COLORS.map((color, index) => (
                  <div
                    key={index}
                    className="w-4 h-4 rounded-sm border border-gray-100"
                    style={{ backgroundColor: color }}
                  />
                ))}
                <span className="text-xs text-gray-500 ml-2">Mehr</span>
              </div>

              {/* Time legend */}
              <div className="mt-2 flex items-center justify-end space-x-6 text-xs text-gray-500">
                <span>0h</span>
                <span>&lt;1h</span>
                <span>&lt;2h</span>
                <span>&lt;4h</span>
                <span>≥4h</span>
              </div>
            </div>
          </div>
        </div>

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

