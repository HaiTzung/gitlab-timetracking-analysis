"use client"

import React, {useState, useEffect} from 'react';
import axios from 'axios';
import { DashboardContext } from '@/context/DashboardContext';
import { startOfWeek, format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths, getDay, getWeek, addWeeks, subWeeks } from 'date-fns';
import { de } from 'date-fns/locale';

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
    GERMAN_DAYS
} from '../config/dashboardConfig';

// Import components
import ProjectOverview from './ProjectOverview';
import TimeSeriesCharts from './TimeSeriesCharts';
import TeamAndCategories from './TeamAndCategories';
import ProductivityAnalysis from './ProductivityAnalysis';
import TeamCollaboration from './TeamCollaboration';
import IssueAnalysis from './IssueAnalysis';
import IssueTimeAnalysis from './IssueTimeAnalysis';
import DetailedActivity from './DetailedActivity';

// Import types
import { Issue, Timelog, ProjectMetrics, ProductivityPatterns, CollaborationData, AverageTeamMembersData, IssueComplexityData, HeatmapData } from '../types/dashboard';

interface TimeTrackingDashboardProps {
    startDate: Date;
    endDate: Date;
}

const TimeTrackingDashboard: React.FC<TimeTrackingDashboardProps> = ({ startDate, endDate }) => {
    const [timelogs, setTimelogs] = useState<Timelog[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadedCount, setLoadedCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const totalFetchCount = TEAM_MEMBERS.length + 1; // +1 for issues

    const REFRESH_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_REFRESH_INTERVAL ?? 300) * 1000;

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
                                issues(first: 100, after: ${endCursor ? `"${endCursor}"` : 'null'}) {
                                    nodes {
                                        title
                                        iid
                                        labels { nodes { title } }
                                        timeEstimate
                                        totalTimeSpent
                                    }
                                    pageInfo {
                                        hasNextPage
                                        endCursor
                                    }
                                }
                            }
                        }
                    `
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );

                const issuesData: any = response.data.data.group.issues;
                allIssues = [...allIssues, ...issuesData.nodes];
                
                hasNextPage = issuesData.pageInfo.hasNextPage;
                endCursor = issuesData.pageInfo.endCursor;
            }

            console.log('Total issues fetched:', allIssues.length);
            setIssues(allIssues);
            setLoadedCount(prev => prev + 1);
        } catch (err) {
            setError(ERROR_MESSAGES.FETCH_ISSUES);
            console.error('Error fetching issues:', err);
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
                                    after: ${endCursor ? `"${endCursor}"` : 'null'},
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
                    `
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );

                const timelogsData: any = response.data.data.group.timelogs;
                allTimelogs = [...allTimelogs, ...timelogsData.nodes];
                
                hasNextPage = timelogsData.pageInfo.hasNextPage;
                endCursor = timelogsData.pageInfo.endCursor;
            }

            console.log(`Total timelogs fetched for ${username}:`, allTimelogs.length);
            setTimelogs((prev: Timelog[]) => [...prev, ...allTimelogs]);
            setLoadedCount(prev => prev + 1);
        } catch (err) {
            setError(`Error fetching timelogs for user ${username}`);
            console.error(`Error fetching timelogs for user ${username}:`, err);
        }
    };

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            setError(null);
            setTimelogs([]);
            setIssues([]);
            setLoadedCount(0);

            try {
                await Promise.all([
                    fetchAllIssues(),
                    ...TEAM_MEMBERS.map(username => fetchTimelogsForUser(username))
                ]);
                setLastRefreshed(new Date());
            } catch (err) {
                setError(ERROR_MESSAGES.LOADING_ERROR);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [startDate, endDate]);

    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(async () => {
            if (loading) return;
            setLoading(true);
            setError(null);
            setTimelogs([]);
            setIssues([]);
            setLoadedCount(0);
            try {
                await Promise.all([
                    fetchAllIssues(),
                    ...TEAM_MEMBERS.map(username => fetchTimelogsForUser(username))
                ]);
                setLastRefreshed(new Date());
            } catch {
                setError(ERROR_MESSAGES.LOADING_ERROR);
            } finally {
                setLoading(false);
            }
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(id);
    }, [autoRefresh, REFRESH_INTERVAL_MS]);

    const processChartData = (timelogs: Timelog[], issues: Issue[]) => {
        // === 1. Piechart (Kategorie-Zeiten gesamt) ===
        const categoryMap: Record<string, number> = { ...CATEGORY_MAP };

        timelogs.forEach(log => {
            if (log.issue && log.issue.labels && log.issue.labels.nodes) {
                log.issue.labels.nodes.forEach(label => {
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
        const weeklyMap: Record<string, Record<string, number>> = {};
        timelogs.forEach(log => {
            if (log.issue && log.issue.labels && log.issue.labels.nodes) {
                const week = format(startOfWeek(new Date(log.spentAt)), "'KW' II yyyy");
                const user = log.user.name;
                if (!weeklyMap[week]) weeklyMap[week] = {};
                if (!weeklyMap[week][user]) weeklyMap[week][user] = 0;
                weeklyMap[week][user] += log.timeSpent;
            }
        });

        const lineData = Object.entries(weeklyMap).map(([week, users]) => {
            const row: Record<string, any> = { week };
            Object.entries(users).forEach(([user, time]) => {
                row[user] = time / TIME_CONFIG.SECONDS_PER_HOUR;
            });
            return row;
        });

        // === 3. Barchart (Gesamtzeit/Person) ===
        const userMap: Record<string, number> = {};
        timelogs.forEach(log => {
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

        timelogs.forEach(log => {
            const date = new Date(log.spentAt);
            const dateStr = format(date, 'yyyy-MM-dd');
            
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
            lastDate = addMonths(lastDate, 1);   // Add one month after
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
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                week.push({
                    date: dateStr,
                    value: heatmapData[dateStr] || 0,
                    day: format(currentDate, 'EEEE', { locale: de }),
                    month: format(currentDate, 'MMMM', { locale: de }),
                    week: getWeek(currentDate),
                    year: format(currentDate, 'yyyy')
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
            weeks.push(week);
        }

        // === Project Management Metrics ===
        // Calculate sprint data (assuming 2-week sprints)
        const sprintData: ProjectMetrics['sprintData'] = [];
        let sprintStartDate = new Date(firstDate!);
        const endDate = new Date(lastDate!);
        
        // Initialize total category hours
        const totalCategoryHours: Record<string, number> = { ...CATEGORY_MAP };
        
        while (sprintStartDate <= endDate) {
            const sprintEnd = addWeeks(sprintStartDate, 1);
            const sprintTimelogs = timelogs.filter(log => {
                const logDate = new Date(log.spentAt);
                return logDate >= sprintStartDate && logDate < sprintEnd;
            });

            // Only process sprints that have data
            if (sprintTimelogs.length > 0) {
                // Calculate sprint metrics
                const totalHours = sprintTimelogs.reduce((sum, log) => sum + log.timeSpent, 0) / TIME_CONFIG.SECONDS_PER_HOUR;
                const sprintCategoryHours: Record<string, number> = { ...CATEGORY_MAP };

                sprintTimelogs.forEach(log => {
                    if (log.issue && log.issue.labels && log.issue.labels.nodes) {
                        log.issue.labels.nodes.forEach(label => {
                            if (sprintCategoryHours[label.title] !== undefined) {
                                sprintCategoryHours[label.title] += log.timeSpent / TIME_CONFIG.SECONDS_PER_HOUR;
                                totalCategoryHours[label.title] += log.timeSpent / TIME_CONFIG.SECONDS_PER_HOUR;
                            }
                        });
                    }
                });

                // Calculate user distribution
                const userHours: Record<string, number> = {};
                sprintTimelogs.forEach(log => {
                    const user = log.user.name;
                    userHours[user] = (userHours[user] || 0) + log.timeSpent / TIME_CONFIG.SECONDS_PER_HOUR;
                });

                sprintData.push({
                    sprintStart: format(sprintStartDate, 'dd.MM.yyyy'),
                    sprintEnd: format(sprintEnd, 'dd.MM.yyyy'),
                    totalHours,
                    categoryHours: sprintCategoryHours,
                    userHours,
                    sprintNumber: sprintData.length + 1
                });
            }

            sprintStartDate = sprintEnd;
        }

        // Calculate category distribution only for sprints with data
        const categoryDistribution = Object.entries(totalCategoryHours).map(([category, hours]) => ({
            category,
            hours: hours / sprintData.length // Average per sprint with data
        }));

        // === Average Team Members per Issue ===
        const categoryTeamMembers: { [key: string]: Set<string> } = {};
        const categoryIssueCount: { [key: string]: Set<string> } = {};
        const issueTeamMembers: { [key: string]: Set<string> } = {};

        timelogs.forEach(log => {
            if (log.issue && log.issue.labels && log.issue.labels.nodes) {
                const issueId = log.issue.iid;
                log.issue.labels.nodes.forEach(label => {
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
                issues.forEach(issueId => {
                    totalTeamMembersPerIssue += issueTeamMembers[issueId].size;
                });

                return {
                    category,
                    averageMembers: totalTeamMembersPerIssue / issues.size,
                    totalIssues: issues.size,
                    totalMembers: members.size
                };
            })
            .sort((a, b) => b.averageMembers - a.averageMembers);

        // === Issue Complexity Analysis ===
        const categoryIssueTime: { [key: string]: { total: number, count: number } } = {};
        const issueTimeMap: { [key: string]: number } = {};

        timelogs.forEach(log => {
            if (log.issue && log.issue.labels && log.issue.labels.nodes) {
                const issueId = log.issue.iid;
                if (!issueTimeMap[issueId]) {
                    issueTimeMap[issueId] = 0;
                }
                issueTimeMap[issueId] += log.timeSpent;

                log.issue.labels.nodes.forEach(label => {
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
            const issue = timelogs.find(log => log.issue?.iid === issueId)?.issue;
            if (issue?.labels?.nodes) {
                issue.labels.nodes.forEach(label => {
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
                totalTime: data.total / TIME_CONFIG.SECONDS_PER_HOUR // Convert to hours
            }))
            .sort((a, b) => b.averageTime - a.averageTime);

        // === Team Collaboration Network ===
        const collaborationMap: { [key: string]: { [key: string]: number } } = {};

        // Group timelogs by issue
        const issueCollaborations: { [key: string]: Set<string> } = {};
        timelogs.forEach(log => {
            if (log.issue?.iid) {
                if (!issueCollaborations[log.issue.iid]) {
                    issueCollaborations[log.issue.iid] = new Set();
                }
                issueCollaborations[log.issue.iid].add(log.user.name);
            }
        });

        // Calculate collaboration frequency
        Object.values(issueCollaborations).forEach(team => {
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
                Object.entries(collaborations)
                    .map(([member2, count]) => ({
                        source: member1,
                        target: member2,
                        value: count
                    }))
            )
            .sort((a, b) => b.value - a.value);

        // === Productivity Patterns Analysis ===
        const hourlyPatterns: { [key: string]: number } = {};
        const weeklyPatterns: { [key: string]: number } = {};

        timelogs.forEach(log => {
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
            value: (hourlyPatterns[hour] || 0) / TIME_CONFIG.SECONDS_PER_HOUR // Convert to hours
        }));

        const weeklyData = GERMAN_DAYS.map((day, index) => ({
            day,
            value: (weeklyPatterns[index] || 0) / TIME_CONFIG.SECONDS_PER_HOUR // Convert to hours
        }));

        // Calculate peak productivity times
        const peakHour = hourlyData.reduce((max, current) => 
            current.value > max.value ? current : max
        );
        const peakDay = weeklyData.reduce((max, current) => 
            current.value > max.value ? current : max
        );

        return { 
            pieData, 
            lineData, 
            barData, 
            heatmapData: weeks,
            projectMetrics: {
                sprintData,
                totalSprints: sprintData.length,
                averageVelocity: sprintData.reduce((sum, sprint) => sum + sprint.totalHours, 0) / sprintData.length,
                categoryDistribution
            },
            averageTeamMembersData,
            issueComplexityData,
            collaborationData,
            productivityPatterns: {
                hourlyData,
                weeklyData,
                peakHour,
                peakDay
            }
        };
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / TIME_CONFIG.SECONDS_PER_HOUR);
        const minutes = Math.floor((seconds % TIME_CONFIG.SECONDS_PER_HOUR) / TIME_CONFIG.SECONDS_PER_MINUTE);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}h`;
    };

    if (loading) {
        const percent = Math.round((loadedCount / totalFetchCount) * 100);
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
                <p className="text-gray-600 text-sm font-medium">
                    {ERROR_MESSAGES.LOADING} ({loadedCount}/{totalFetchCount})
                </p>
                <div className="w-72 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <p className="text-gray-400 text-xs">{percent}%</p>
            </div>
        );
    }

    if (error) {
        return <div className="alert alert--danger">{error}</div>;
    }

    if (timelogs.length === 0) {
        return <div className="alert alert--warning">{ERROR_MESSAGES.NO_DATA}</div>;
    }

    const {
        pieData,
        lineData,
        barData,
        heatmapData,
        projectMetrics,
        averageTeamMembersData,
        issueComplexityData,
        collaborationData,
        productivityPatterns
    } = processChartData(
        selectedCategory
            ? timelogs.filter(t => t.issue?.labels?.nodes?.some(l => l.title === selectedCategory))
            : timelogs,
        selectedCategory
            ? issues.filter(i => i.labels?.nodes?.some(l => l.title === selectedCategory))
            : issues
    );

    const userLastLogged: Record<string, string | null> = Object.fromEntries(
        TEAM_MEMBERS.map(username => {
            const userLogs = timelogs.filter(t => t.user.username === username);
            const latest = userLogs.length > 0
                ? userLogs.reduce((a, b) => a.spentAt > b.spentAt ? a : b).spentAt
                : null;
            return [username, latest];
        })
    );

    return (
        <DashboardContext.Provider value={{
            lastRefreshed,
            autoRefresh,
            refreshIntervalMs: REFRESH_INTERVAL_MS,
            timelogs,
            onToggleAutoRefresh: () => setAutoRefresh(prev => !prev),
        }}>
        <div className="space-y-10">
            {/* Filter chip */}
            {selectedCategory && (
                <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        Filter: {selectedCategory}
                        <button onClick={() => setSelectedCategory(null)} className="ml-1 hover:text-blue-900">✕</button>
                    </span>
                </div>
            )}

            <ProjectOverview
                projectMetrics={projectMetrics}
                issues={issues}
            />

            <DetailedActivity 
                heatmapData={heatmapData}
                HEATMAP_COLORS={[...COLORS.HEATMAP]}
                formatTime={formatTime}
            />

            <TimeSeriesCharts 
                projectMetrics={projectMetrics}
                lineData={lineData}
                barData={barData}
                TEAM_COLORS={[...COLORS.TEAM]}
                COLORS={[...COLORS.PRIMARY]}
            />

            <TeamAndCategories
                pieData={pieData}
                barData={barData}
                COLORS={[...COLORS.PRIMARY]}
                userLastLogged={userLastLogged}
                teamMembers={[...TEAM_MEMBERS]}
                selectedCategory={selectedCategory}
                onCategorySelect={setSelectedCategory}
            />

            <ProductivityAnalysis 
                productivityPatterns={productivityPatterns}
            />

            <TeamCollaboration 
                collaborationData={collaborationData}
                averageTeamMembersData={averageTeamMembersData}
                COLORS={[...COLORS.PRIMARY]}
            />

            <IssueAnalysis 
                issueComplexityData={issueComplexityData}
                COLORS={[...COLORS.PRIMARY]}
            />

            <IssueTimeAnalysis 
                issues={issues}
            />

        </div>
        </DashboardContext.Provider>
    );
};

export default TimeTrackingDashboard;
