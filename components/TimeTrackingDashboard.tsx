"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useDashboardContextSetter, TimeWindow } from "@/context/DashboardContext";
import {
  startOfWeek,
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  getDay,
  getWeek,
  addWeeks,
  subWeeks,
  subDays,
} from "date-fns";
import { de } from "date-fns/locale";

// Import configuration
import {
  GITLAB_CONFIG,
  TEAM_MEMBERS,
  CATEGORIES,
  CATEGORY_MAP,
  COLORS,
  TIME_CONFIG,
  ERROR_MESSAGES,
  DEVIATION_THRESHOLDS,
  DISPLAY_CONFIG,
  GERMAN_DAYS,
} from "../config/dashboardConfig";

// Import components
import ProjectOverview from "./ProjectOverview";
import TimeSeriesCharts from "./TimeSeriesCharts";
import TeamAndCategories from "./TeamAndCategories";
import ProductivityAnalysis from "./ProductivityAnalysis";
import TeamCollaboration from "./TeamCollaboration";
import IssueAnalysis from "./IssueAnalysis";
import IssueDashboard from "./IssueDashboard";
import DetailedActivity from "./DetailedActivity";
import Leaderboard from "./Leaderboard";
import PresentationMode from "./PresentationMode";

// Import types
import {
  Issue,
  Epic,
  Timelog,
  ProjectMetrics,
  ProductivityPatterns,
  CollaborationData,
  AverageTeamMembersData,
  IssueComplexityData,
  HeatmapData,
} from "../types/dashboard";

interface TimeTrackingDashboardProps {
  startDate: Date;
  endDate: Date;
}

const TimeTrackingDashboard: React.FC<TimeTrackingDashboardProps> = ({ startDate, endDate }) => {
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [issueStatuses, setIssueStatuses] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [tuOffset, setTuOffset] = useState(true);
  const [presentationMode, setPresentationMode] = useState(false);
  const totalFetchCount = TEAM_MEMBERS.length + 4; // +1 issues, +1 epics, +1 workitem statuses, +1 notes

  const rawInterval = Number(process.env.NEXT_PUBLIC_REFRESH_INTERVAL ?? 300);
  const REFRESH_INTERVAL_MS =
    Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval * 1000 : 300_000;
  const setToolbarState = useDashboardContextSetter();

  const fetchAllIssues = async (): Promise<void> => {
    try {
      let allIssues: Issue[] = [];
      let hasNextPage = true;
      let endCursor: string | null = null;

      while (hasNextPage) {
        const response: any = await axios.post(
          GITLAB_CONFIG.API_URL,
          {
            query: `
                        {
                            group(fullPath: "${GITLAB_CONFIG.GROUP_PATH}") {
                                issues(first: 100, after: ${endCursor ? `"${endCursor}"` : "null"}) {
                                    nodes {
                                        title
                                        iid
                                        state
                                        webUrl
                                        createdAt
                                        updatedAt
                                        closedAt
                                        dueDate
                                        weight
                                        healthStatus
                                        milestone { title dueDate }
                                        assignees { nodes { name username } }
                                        author { username }
                                        labels { nodes { title } }
                                        timeEstimate
                                        totalTimeSpent
                                        epic { iid }
                                    }
                                    pageInfo {
                                        hasNextPage
                                        endCursor
                                    }
                                }
                            }
                        }
                    `,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        const issuesData: any = response.data.data.group.issues;
        allIssues = [...allIssues, ...issuesData.nodes];

        hasNextPage = issuesData.pageInfo.hasNextPage;
        endCursor = issuesData.pageInfo.endCursor;
      }

      console.log("Total issues fetched:", allIssues.length);
      setIssues(allIssues);
      setLoadedCount((prev) => prev + 1);
    } catch (err) {
      setError(ERROR_MESSAGES.FETCH_ISSUES);
      console.error("Error fetching issues:", err);
      throw err;
    }
  };

  const fetchAllEpics = async (): Promise<void> => {
    try {
      let allEpics: Epic[] = [];
      let hasNextPage = true;
      let endCursor: string | null = null;

      while (hasNextPage) {
        const response: any = await axios.post(
          GITLAB_CONFIG.API_URL,
          {
            query: `
                        {
                            group(fullPath: "${GITLAB_CONFIG.GROUP_PATH}") {
                                epics(first: 100, after: ${endCursor ? `"${endCursor}"` : "null"}) {
                                    nodes {
                                        id
                                        iid
                                        title
                                        state
                                        webUrl
                                        startDate
                                        dueDate
                                        descendantCounts {
                                            openedIssues
                                            closedIssues
                                            openedEpics
                                            closedEpics
                                        }
                                        parent { iid }
                                        issues(first: 100) {
                                            nodes { iid }
                                        }
                                    }
                                    pageInfo {
                                        hasNextPage
                                        endCursor
                                    }
                                }
                            }
                        }
                    `,
          },
          { headers: { "Content-Type": "application/json" } },
        );

        const epicsData: any = response.data.data.group.epics;
        allEpics = [...allEpics, ...epicsData.nodes];
        hasNextPage = epicsData.pageInfo.hasNextPage;
        endCursor = epicsData.pageInfo.endCursor;
      }

      setEpics(allEpics);
      setLoadedCount((prev) => prev + 1);
    } catch (err) {
      console.error("Error fetching epics:", err);
      setLoadedCount((prev) => prev + 1); // non-fatal: continue without epics
    }
  };

  const fetchWorkItemStatuses = async (): Promise<void> => {
    try {
      // Fetch all project paths under the group
      const projectsResp: any = await axios.post(
        GITLAB_CONFIG.API_URL,
        {
          query: `{ group(fullPath: "${GITLAB_CONFIG.GROUP_PATH}") { projects { nodes { fullPath } } } }`,
        },
        { headers: { "Content-Type": "application/json" } },
      );

      const projectPaths: string[] =
        projectsResp.data?.data?.group?.projects?.nodes?.map((p: any) => p.fullPath) ?? [];

      const statusMap = new Map<string, string>();

      await Promise.all(
        projectPaths.map(async (fullPath: string) => {
          let cursor: string | null = null;
          let more = true;
          while (more) {
            const resp: any = await axios.post(
              GITLAB_CONFIG.API_URL,
              {
                query: `{
                            project(fullPath: "${fullPath}") {
                                workItems(first: 100, after: ${cursor ? `"${cursor}"` : "null"}) {
                                    nodes {
                                        iid
                                        widgets {
                                            type
                                            ... on WorkItemWidgetStatus {
                                                status { name }
                                            }
                                        }
                                    }
                                    pageInfo { hasNextPage endCursor }
                                }
                            }
                        }`,
              },
              { headers: { "Content-Type": "application/json" } },
            );

            const wi = resp.data?.data?.project?.workItems;
            if (!wi) break;
            for (const node of wi.nodes ?? []) {
              const statusWidget = node.widgets?.find((w: any) => w.type === "STATUS");
              if (statusWidget?.status?.name) {
                statusMap.set(node.iid, statusWidget.status.name);
              }
            }
            more = wi.pageInfo?.hasNextPage ?? false;
            cursor = wi.pageInfo?.endCursor ?? null;
          }
        }),
      );

      setIssueStatuses(statusMap);
    } catch (err) {
      console.error("Error fetching work item statuses:", err);
      // non-fatal: badges just won't show In Progress
    }
  };

  const fetchIssueNotes = async (): Promise<void> => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      let hasNextPage = true;
      let endCursor: string | null = null;
      const notesByIid: Record<string, Issue['notes']> = {};

      while (hasNextPage) {
        const response: any = await axios.post(
          GITLAB_CONFIG.API_URL,
          {
            query: `
              {
                group(fullPath: "${GITLAB_CONFIG.GROUP_PATH}") {
                  issues(first: 50, after: ${endCursor ? `"${endCursor}"` : "null"}, updatedAfter: "${sevenDaysAgo}") {
                    nodes {
                      iid
                      notes(first: 50) {
                        nodes {
                          id
                          body
                          createdAt
                          author { name }
                          system
                          url
                        }
                      }
                    }
                    pageInfo { hasNextPage endCursor }
                  }
                }
              }
            `,
          },
          { headers: { "Content-Type": "application/json" } },
        );

        const issuesData = response.data.data.group.issues;
        for (const issue of issuesData.nodes) {
          notesByIid[issue.iid] = {
            nodes: issue.notes.nodes.filter((n: any) => !n.system),
          };
        }
        hasNextPage = issuesData.pageInfo.hasNextPage;
        endCursor = issuesData.pageInfo.endCursor;
      }

      setIssues(prev => prev.map(issue => ({
        ...issue,
        notes: notesByIid[issue.iid] ?? { nodes: [] },
      })));
      setLoadedCount(prev => prev + 1);
    } catch (err) {
      console.error("Error fetching issue notes:", err);
      setLoadedCount(prev => prev + 1); // non-fatal
    }
  };

  const fetchTimelogsForUser = async (username: string): Promise<void> => {
    try {
      let allTimelogs: Timelog[] = [];
      let hasNextPage = true;
      let endCursor: string | null = null;

      while (hasNextPage) {
        const response: any = await axios.post(
          GITLAB_CONFIG.API_URL,
          {
            query: `
                        {
                            group(fullPath: "${GITLAB_CONFIG.GROUP_PATH}") {
                                timelogs(
                                    first: 100,
                                    after: ${endCursor ? `"${endCursor}"` : "null"},
                                    startDate: "${startDate.toISOString()}", 
                                    endDate: "${endDate.toISOString()}", 
                                    username: "${username}"
                                ) {
                                    nodes {
                                        user { name username }
                                        issue {
                                            title
                                            iid
                                            labels { nodes { title } }
                                            timeEstimate
                                            totalTimeSpent
                                        }
                                        spentAt
                                        timeSpent
                                    }
                                    pageInfo {
                                        hasNextPage
                                        endCursor
                                    }
                                }
                            }
                        }
                    `,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        const timelogsData: any = response.data.data.group.timelogs;
        allTimelogs = [...allTimelogs, ...timelogsData.nodes];

        hasNextPage = timelogsData.pageInfo.hasNextPage;
        endCursor = timelogsData.pageInfo.endCursor;
      }

      console.log(`Total timelogs fetched for ${username}:`, allTimelogs.length);
      setTimelogs((prev: Timelog[]) => [...prev, ...allTimelogs]);
      setLoadedCount((prev) => prev + 1);
    } catch (err) {
      setError(`Error fetching timelogs for user ${username}`);
      console.error(`Error fetching timelogs for user ${username}:`, err);
      throw err;
    }
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTimelogs([]);
    setIssues([]);
    setEpics([]);
    setLoadedCount(0);
    try {
      await Promise.all([
        fetchAllIssues(),
        fetchAllEpics(),
        fetchWorkItemStatuses(),
        ...TEAM_MEMBERS.map((username) => fetchTimelogsForUser(username)),
      ]);
      await fetchIssueNotes();
      setLastRefreshed(new Date());
    } catch {
      setError(ERROR_MESSAGES.LOADING_ERROR);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manualRefresh = useCallback(async () => {
    const scroller = document.getElementById('main-scroll');
    const scrollY = scroller?.scrollTop ?? 0;
    setBackgroundRefreshing(true);
    setBgLoaded(0);
    setError(null);
    setTimelogs([]);
    setIssues([]);
    setEpics([]);
    setIssueStatuses(new Map());
    setLoadedCount(0);

    const tick = () => setBgLoaded((n) => n + 1);

    try {
      await Promise.all([
        fetchAllIssues().then(tick),
        fetchAllEpics().then(tick),
        fetchWorkItemStatuses().then(tick),
        ...TEAM_MEMBERS.map((username) => fetchTimelogsForUser(username).then(tick)),
      ]);
      await fetchIssueNotes().then(tick);
      setLastRefreshed(new Date());
    } catch {
      setError(ERROR_MESSAGES.LOADING_ERROR);
    } finally {
      setBackgroundRefreshing(false);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const s = document.getElementById('main-scroll');
        if (s) s.scrollTop = scrollY;
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (loading || backgroundRefreshing) return;
      fetchAllData();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, REFRESH_INTERVAL_MS, loading, backgroundRefreshing, fetchAllData]);

  useEffect(() => {
    setToolbarState({
      lastRefreshed,
      autoRefresh,
      refreshIntervalMs: REFRESH_INTERVAL_MS,
      timelogs,
      onToggleAutoRefresh: () => setAutoRefresh((prev) => !prev),
      onRefresh: manualRefresh,
      onPresentationMode: () => setPresentationMode(true),
      timeWindow,
      onSetTimeWindow: (w: TimeWindow) => setTimeWindow(w),
      customStart,
      customEnd,
      onSetCustomDates: (start, end) => {
        setCustomStart(start);
        setCustomEnd(end);
      },
      tuOffset,
      onSetTuOffset: (v) => setTuOffset(v),
    });
  }, [
    lastRefreshed,
    autoRefresh,
    timelogs,
    REFRESH_INTERVAL_MS,
    timeWindow,
    customStart,
    customEnd,
    tuOffset,
  ]);

  const filterByWindow = (logs: Timelog[]): Timelog[] => {
    if (timeWindow === "all") return logs;
    const now = new Date();
    const from =
      timeWindow === "7d"
        ? subDays(now, 7)
        : timeWindow === "14d"
          ? subDays(now, 14)
          : timeWindow === "month"
            ? startOfMonth(now)
            : (timeWindow === "custom" || timeWindow === "kw")
              ? customStart
              : null;
    const to = (timeWindow === "custom" || timeWindow === "kw") && customEnd ? customEnd : now;
    return logs.filter((l) => {
      const d = new Date(l.spentAt);
      return (!from || d >= from) && d <= to;
    });
  };

  const processChartData = (timelogs: Timelog[], issues: Issue[]) => {
    // === 1. Piechart (Kategorie-Zeiten gesamt) ===
    const categoryMap: Record<string, number> = { ...CATEGORY_MAP };

    timelogs.forEach((log) => {
      if (log.issue && log.issue.labels && log.issue.labels.nodes) {
        log.issue.labels.nodes.forEach((label) => {
          if (categoryMap[label.title] !== undefined) {
            categoryMap[label.title] += log.timeSpent;
          }
        });
      }
    });

    const pieData = Object.entries(categoryMap).map(([name, value]) => ({
      name,
      value: value / TIME_CONFIG.SECONDS_PER_HOUR,
    }));

    // === 2. Linechart (Zeit/Woche/Person) ===
    // Build username → display name map first (used in lineData and barData)
    const usernameToName: Record<string, string> = {};
    timelogs.forEach((log) => { usernameToName[log.user.username] = log.user.name; });

    const weeklyMap: Record<string, Record<string, number>> = {};
    timelogs.forEach((log) => {
      if (log.issue && log.issue.labels && log.issue.labels.nodes) {
        const week = format(startOfWeek(new Date(log.spentAt)), "'KW' II yyyy");
        const user = log.user.name;
        if (!weeklyMap[week]) weeklyMap[week] = {};
        if (!weeklyMap[week][user]) weeklyMap[week][user] = 0;
        weeklyMap[week][user] += log.timeSpent;
      }
    });

    const lineData = Object.entries(weeklyMap)
      .sort(([a], [b]) => {
        // Parse "KW 42 2026" back to a sortable date: year * 100 + week
        const parse = (s: string) => {
          const [, kw, yr] = s.split(" ");
          return Number(yr) * 100 + Number(kw);
        };
        return parse(a) - parse(b);
      })
      .map(([week, users]) => {
        const row: Record<string, any> = { week };
        TEAM_MEMBERS.forEach((member) => {
          const userName = usernameToName[member] ?? member;
          row[userName] = (users[userName] ?? 0) / TIME_CONFIG.SECONDS_PER_HOUR;
        });
        Object.entries(users).forEach(([user, time]) => {
          if (row[user] === undefined) row[user] = time / TIME_CONFIG.SECONDS_PER_HOUR;
        });
        return row;
      });

    // === 3. Barchart (Gesamtzeit/Person) ===
    const userMap: Record<string, number> = {};
    // Seed all team members with 0 so they always appear
    TEAM_MEMBERS.forEach((username) => {
      const displayName = usernameToName[username] ?? username;
      userMap[displayName] = 0;
    });
    timelogs.forEach((log) => {
      const user = log.user.name;
      if (!userMap[user]) userMap[user] = 0;
      userMap[user] += log.timeSpent;
    });

    const barData = Object.entries(userMap).map(([name, value]) => ({
      name,
      value: value / TIME_CONFIG.SECONDS_PER_HOUR,
    }));

    // === Heatmap Data ===
    const heatmapData: Record<string, number> = {};
    let firstDate: Date | null = null;
    let lastDate: Date | null = null;

    timelogs.forEach((log) => {
      const date = new Date(log.spentAt);
      const dateStr = format(date, "yyyy-MM-dd");

      if (!firstDate || date < firstDate) {
        firstDate = date;
      }
      if (!lastDate || date > lastDate) {
        lastDate = date;
      }

      if (!heatmapData[dateStr]) {
        heatmapData[dateStr] = 0;
      }
      heatmapData[dateStr] += log.timeSpent;
    });

    // Add some padding before and after the data range
    if (firstDate && lastDate) {
      firstDate = subMonths(firstDate, 1); // Add one month before
      lastDate = addMonths(lastDate, 1); // Add one month after
    } else {
      // Fallback if no data
      lastDate = new Date();
      firstDate = subMonths(lastDate, 6);
    }

    // Create a grid of weeks
    const weeks: HeatmapData[][] = [];
    let currentDate = new Date(firstDate);
    currentDate.setDate(currentDate.getDate() - getDay(currentDate)); // Start from Sunday

    while (currentDate <= lastDate) {
      const week: HeatmapData[] = [];
      for (let i = 0; i < TIME_CONFIG.DAYS_PER_WEEK; i++) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        week.push({
          date: dateStr,
          value: heatmapData[dateStr] || 0,
          day: format(currentDate, "EEEE", { locale: de }),
          month: format(currentDate, "MMMM", { locale: de }),
          week: getWeek(currentDate),
          year: format(currentDate, "yyyy"),
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    // === Project Management Metrics ===
    // Calculate sprint data (assuming 2-week sprints)
    const sprintData: ProjectMetrics["sprintData"] = [];
    let sprintStartDate = new Date(firstDate!);
    const endDate = new Date(lastDate!);

    // Initialize total category hours
    const totalCategoryHours: Record<string, number> = { ...CATEGORY_MAP };

    while (sprintStartDate <= endDate) {
      const sprintEnd = addWeeks(sprintStartDate, 1);
      const sprintTimelogs = timelogs.filter((log) => {
        const logDate = new Date(log.spentAt);
        return logDate >= sprintStartDate && logDate < sprintEnd;
      });

      // Only process sprints that have data
      if (sprintTimelogs.length > 0) {
        // Calculate sprint metrics
        const totalHours =
          sprintTimelogs.reduce((sum, log) => sum + log.timeSpent, 0) /
          TIME_CONFIG.SECONDS_PER_HOUR;
        const sprintCategoryHours: Record<string, number> = { ...CATEGORY_MAP };

        sprintTimelogs.forEach((log) => {
          if (log.issue && log.issue.labels && log.issue.labels.nodes) {
            log.issue.labels.nodes.forEach((label) => {
              if (sprintCategoryHours[label.title] !== undefined) {
                sprintCategoryHours[label.title] += log.timeSpent / TIME_CONFIG.SECONDS_PER_HOUR;
                totalCategoryHours[label.title] += log.timeSpent / TIME_CONFIG.SECONDS_PER_HOUR;
              }
            });
          }
        });

        // Calculate user distribution
        const userHours: Record<string, number> = {};
        sprintTimelogs.forEach((log) => {
          const user = log.user.name;
          userHours[user] = (userHours[user] || 0) + log.timeSpent / TIME_CONFIG.SECONDS_PER_HOUR;
        });

        sprintData.push({
          sprintStart: format(sprintStartDate, "dd.MM.yyyy"),
          sprintEnd: format(sprintEnd, "dd.MM.yyyy"),
          totalHours,
          categoryHours: sprintCategoryHours,
          userHours,
          sprintNumber: sprintData.length + 1,
        });
      }

      sprintStartDate = sprintEnd;
    }

    // Calculate category distribution only for sprints with data
    const categoryDistribution = Object.entries(totalCategoryHours).map(([category, hours]) => ({
      category,
      hours: sprintData.length > 0 ? hours / sprintData.length : 0, // Average per sprint with data
    }));

    // === Average Team Members per Issue ===
    const categoryTeamMembers: { [key: string]: Set<string> } = {};
    const categoryIssueCount: { [key: string]: Set<string> } = {};
    const issueTeamMembers: { [key: string]: Set<string> } = {};

    timelogs.forEach((log) => {
      if (log.issue && log.issue.labels && log.issue.labels.nodes) {
        const issueId = log.issue.iid;
        log.issue.labels.nodes.forEach((label) => {
          if (categoryMap[label.title] !== undefined) {
            // Initialize sets if they don't exist
            if (!categoryTeamMembers[label.title]) {
              categoryTeamMembers[label.title] = new Set<string>();
              categoryIssueCount[label.title] = new Set<string>();
            }
            if (!issueTeamMembers[issueId]) {
              issueTeamMembers[issueId] = new Set<string>();
            }

            // Add team member to both category and issue sets
            categoryTeamMembers[label.title].add(log.user.name);
            categoryIssueCount[label.title].add(issueId);
            issueTeamMembers[issueId].add(log.user.name);
          }
        });
      }
    });

    // Calculate average team members per issue for each category
    const averageTeamMembersData: AverageTeamMembersData[] = Object.entries(categoryTeamMembers)
      .map(([category, members]) => {
        const issues = categoryIssueCount[category];
        let totalTeamMembersPerIssue = 0;

        // Sum up team members for each issue in this category
        issues.forEach((issueId) => {
          totalTeamMembersPerIssue += issueTeamMembers[issueId].size;
        });

        return {
          category,
          averageMembers: totalTeamMembersPerIssue / issues.size,
          totalIssues: issues.size,
          totalMembers: members.size,
        };
      })
      .sort((a, b) => b.averageMembers - a.averageMembers);

    // === Issue Complexity Analysis ===
    const categoryIssueTime: { [key: string]: { total: number; count: number } } = {};
    const issueTimeMap: { [key: string]: number } = {};

    timelogs.forEach((log) => {
      if (log.issue && log.issue.labels && log.issue.labels.nodes) {
        const issueId = log.issue.iid;
        if (!issueTimeMap[issueId]) {
          issueTimeMap[issueId] = 0;
        }
        issueTimeMap[issueId] += log.timeSpent;

        log.issue.labels.nodes.forEach((label) => {
          if (categoryMap[label.title] !== undefined) {
            if (!categoryIssueTime[label.title]) {
              categoryIssueTime[label.title] = { total: 0, count: 0 };
            }
          }
        });
      }
    });

    // Calculate average time per issue for each category
    Object.entries(issueTimeMap).forEach(([issueId, time]) => {
      const issue = timelogs.find((log) => log.issue?.iid === issueId)?.issue;
      if (issue?.labels?.nodes) {
        issue.labels.nodes.forEach((label) => {
          if (categoryIssueTime[label.title]) {
            categoryIssueTime[label.title].total += time;
            categoryIssueTime[label.title].count += 1;
          }
        });
      }
    });

    const issueComplexityData: IssueComplexityData[] = Object.entries(categoryIssueTime)
      .map(([category, data]) => ({
        category,
        averageTime: data.total / data.count / TIME_CONFIG.SECONDS_PER_HOUR, // Convert to hours
        totalIssues: data.count,
        totalTime: data.total / TIME_CONFIG.SECONDS_PER_HOUR, // Convert to hours
      }))
      .sort((a, b) => b.averageTime - a.averageTime);

    // === Team Collaboration Network ===
    const collaborationMap: { [key: string]: { [key: string]: number } } = {};

    // Group timelogs by issue
    const issueCollaborations: { [key: string]: Set<string> } = {};
    timelogs.forEach((log) => {
      if (log.issue?.iid) {
        if (!issueCollaborations[log.issue.iid]) {
          issueCollaborations[log.issue.iid] = new Set();
        }
        issueCollaborations[log.issue.iid].add(log.user.name);
      }
    });

    // Calculate collaboration frequency
    Object.values(issueCollaborations).forEach((team) => {
      const teamArray = Array.from(team).sort(); // Sort to ensure consistent ordering
      for (let i = 0; i < teamArray.length; i++) {
        for (let j = i + 1; j < teamArray.length; j++) {
          const member1 = teamArray[i];
          const member2 = teamArray[j];

          if (!collaborationMap[member1]) {
            collaborationMap[member1] = {};
          }

          collaborationMap[member1][member2] = (collaborationMap[member1][member2] || 0) + 1;
        }
      }
    });

    const collaborationData: CollaborationData[] = Object.entries(collaborationMap)
      .flatMap(([member1, collaborations]) =>
        Object.entries(collaborations).map(([member2, count]) => ({
          source: member1,
          target: member2,
          value: count,
        })),
      )
      .sort((a, b) => b.value - a.value);

    // === Productivity Patterns Analysis ===
    const hourlyPatterns: { [key: string]: number } = {};
    const weeklyPatterns: { [key: string]: number } = {};

    timelogs.forEach((log) => {
      const date = new Date(log.spentAt);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      // Hourly patterns
      if (!hourlyPatterns[hour]) {
        hourlyPatterns[hour] = 0;
      }
      hourlyPatterns[hour] += log.timeSpent;

      // Weekly patterns
      if (!weeklyPatterns[dayOfWeek]) {
        weeklyPatterns[dayOfWeek] = 0;
      }
      weeklyPatterns[dayOfWeek] += log.timeSpent;
    });

    // Convert to arrays for charts
    const hourlyData = Array.from({ length: TIME_CONFIG.HOURS_PER_DAY }, (_, hour) => ({
      hour: `${hour}:00`,
      value: (hourlyPatterns[hour] || 0) / TIME_CONFIG.SECONDS_PER_HOUR, // Convert to hours
    }));

    const weeklyData = GERMAN_DAYS.map((day, index) => ({
      day,
      value: (weeklyPatterns[index] || 0) / TIME_CONFIG.SECONDS_PER_HOUR, // Convert to hours
    }));

    // Calculate peak productivity times
    const peakHour = hourlyData.reduce((max, current) =>
      current.value > max.value ? current : max,
    );
    const peakDay = weeklyData.reduce((max, current) =>
      current.value > max.value ? current : max,
    );

    return {
      pieData,
      lineData,
      barData,
      heatmapData: weeks,
      projectMetrics: {
        sprintData,
        totalSprints: sprintData.length,
        averageVelocity:
          sprintData.length > 0
            ? sprintData.reduce((sum, sprint) => sum + sprint.totalHours, 0) / sprintData.length
            : 0,
        categoryDistribution,
      },
      averageTeamMembersData,
      issueComplexityData,
      collaborationData,
      productivityPatterns: {
        hourlyData,
        weeklyData,
        peakHour,
        peakDay,
      },
    };
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / TIME_CONFIG.SECONDS_PER_HOUR);
    const minutes = Math.floor(
      (seconds % TIME_CONFIG.SECONDS_PER_HOUR) / TIME_CONFIG.SECONDS_PER_MINUTE,
    );
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}h`;
  };

  if (loading && !backgroundRefreshing) {
    const percent = Math.round((loadedCount / totalFetchCount) * 100);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
          {ERROR_MESSAGES.LOADING} ({loadedCount}/{totalFetchCount})
        </p>
        <div className="w-72 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-gray-400 dark:text-gray-500 text-xs">{percent}%</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <p className="text-red-600 font-semibold text-sm">Fehler beim Laden</p>
        <p className="text-red-500 text-xs max-w-sm text-center">{error}</p>
      </div>
    );
  }

  if (timelogs.length === 0) {
    return <div className="alert alert--warning">{ERROR_MESSAGES.NO_DATA}</div>;
  }

  const windowTimelogs = filterByWindow(timelogs);

  const {
    pieData,
    lineData,
    barData,
    heatmapData,
    projectMetrics,
    averageTeamMembersData,
    issueComplexityData,
    collaborationData,
    productivityPatterns,
  } = processChartData(
    selectedCategory
      ? windowTimelogs.filter((t) =>
          t.issue?.labels?.nodes?.some((l) => l.title === selectedCategory),
        )
      : windowTimelogs,
    selectedCategory
      ? issues.filter((i) => i.labels?.nodes?.some((l) => l.title === selectedCategory))
      : issues,
  );

  const userLastLogged: Record<string, string | null> = Object.fromEntries(
    TEAM_MEMBERS.map((username) => {
      const userLogs = windowTimelogs.filter((t) => t.user.username === username);
      const latest =
        userLogs.length > 0
          ? userLogs.reduce((a, b) => (a.spentAt > b.spentAt ? a : b)).spentAt
          : null;
      return [username, latest];
    }),
  );

  // Issues active in the current time window (have at least one timelog in the window)
  const windowIssueIds = new Set(windowTimelogs.map((t) => t.issue?.iid).filter(Boolean));
  const windowIssues =
    timeWindow === "all" ? issues : issues.filter((i) => windowIssueIds.has(i.iid));

  return (
    <>
    <div className="space-y-10">
      {/* Background refresh progress bar */}
      {backgroundRefreshing && (
        <div className="fixed top-14 left-0 right-0 z-30 h-0.5 bg-blue-100 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.round((bgLoaded / totalFetchCount) * 100)}%` }}
          />
        </div>
      )}
      {/* Filter chip */}
      {selectedCategory && (
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Filter: {selectedCategory}
            <button onClick={() => setSelectedCategory(null)} className="ml-1 hover:text-blue-900">
              ✕
            </button>
          </span>
        </div>
      )}

      <ProjectOverview projectMetrics={projectMetrics} issues={issues} />

      <DetailedActivity
        formatTime={formatTime}
        timelogs={timelogs}
        issues={issues}
        timeWindow={timeWindow}
        customStart={customStart}
        customEnd={customEnd}
        usernameToName={Object.fromEntries(timelogs.map(t => [t.user.username, t.user.name]))}
        projectMetrics={projectMetrics}
        COLORS={[...COLORS.PRIMARY]}
        lineData={lineData}
        barData={barData}
        TEAM_COLORS={[...COLORS.TEAM]}
      />

      <IssueDashboard issues={issues} epics={epics} issueStatuses={issueStatuses} timelogs={windowTimelogs} projectMetrics={projectMetrics} />

      <IssueAnalysis issueComplexityData={issueComplexityData} COLORS={[...COLORS.PRIMARY]} issues={issues} />

      <TimeSeriesCharts
        projectMetrics={projectMetrics}
        lineData={lineData}
        barData={barData}
        TEAM_COLORS={[...COLORS.TEAM]}
        COLORS={[...COLORS.PRIMARY]}
        issues={issues}
        timelogs={timelogs}
      />

      <TeamAndCategories
        pieData={pieData}
        barData={barData}
        COLORS={[...COLORS.PRIMARY]}
        userLastLogged={userLastLogged}
        teamMembers={[...TEAM_MEMBERS]}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        timelogs={windowTimelogs}
        allTimelogs={timelogs}
        usernameToName={Object.fromEntries(timelogs.map(t => [t.user.username, t.user.name]))}
      />

      <Leaderboard
        timelogs={timelogs}
        issues={issues}
        teamMembers={[...TEAM_MEMBERS]}
        usernameToName={Object.fromEntries(timelogs.map(t => [t.user.username, t.user.name]))}
      />

      <ProductivityAnalysis productivityPatterns={productivityPatterns} />

      <TeamCollaboration
        collaborationData={collaborationData}
        averageTeamMembersData={averageTeamMembersData}
        COLORS={[...COLORS.PRIMARY]}
      />
    </div>

    {presentationMode && (
      <PresentationMode
        onClose={() => setPresentationMode(false)}
        timelogs={timelogs}
        windowTimelogs={windowTimelogs}
        issues={issues}
        epics={epics}
        issueStatuses={issueStatuses}
        formatTime={formatTime}
        projectMetrics={projectMetrics}
        lineData={lineData}
        barData={barData}
        pieData={pieData}
        COLORS={[...COLORS.PRIMARY]}
        TEAM_COLORS={[...COLORS.TEAM]}
        userLastLogged={userLastLogged}
        teamMembers={[...TEAM_MEMBERS]}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        usernameToName={Object.fromEntries(timelogs.map(t => [t.user.username, t.user.name]))}
        timeWindow={timeWindow}
        customStart={customStart}
        customEnd={customEnd}
        onSetTimeWindow={(w) => setTimeWindow(w)}
        onSetCustomDates={(start, end) => { setCustomStart(start); setCustomEnd(end); }}
      />
    )}
    </>
  );
};

export default TimeTrackingDashboard;
