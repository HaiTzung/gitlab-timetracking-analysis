export interface Issue {
    title: string;
    timeEstimate: number;
    totalTimeSpent: number;
    category: string;
    iid: string;
    state: string;
    labels: {
        nodes: Array<{title: string}>;
    };
}

export interface Timelog {
    user: { name: string; username: string };
    issue: {
        title: string;
        iid: string;
        labels: { nodes: Array<{title: string}> };
        timeEstimate: number;
        totalTimeSpent: number;
    };
    spentAt: string;
    timeSpent: number;
}

export interface ProjectMetrics {
    sprintData: Array<{
        sprintStart: string;
        sprintEnd: string;
        totalHours: number;
        categoryHours: Record<string, number>;
        userHours: Record<string, number>;
        sprintNumber: number;
    }>;
    totalSprints: number;
    averageVelocity: number;
    categoryDistribution: Array<{category: string; hours: number}>;
}

export interface ProductivityPatterns {
    hourlyData: Array<{hour: string; value: number}>;
    weeklyData: Array<{day: string; value: number}>;
    peakHour: {hour: string; value: number};
    peakDay: {day: string; value: number};
}

export interface CollaborationData {
    source: string;
    target: string;
    value: number;
}

export interface AverageTeamMembersData {
    category: string;
    averageMembers: number;
    totalIssues: number;
    totalMembers: number;
}

export interface IssueComplexityData {
    category: string;
    averageTime: number;
    totalIssues: number;
    totalTime: number;
}

export interface HeatmapData {
    date: string;
    value: number;
    day: string;
    month: string;
    week: number;
    year: string;
} 