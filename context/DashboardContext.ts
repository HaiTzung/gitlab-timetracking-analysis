'use client';

import { createContext, useContext } from 'react';

export interface DashboardToolbarState {
    lastRefreshed: Date | null;
    autoRefresh: boolean;
    refreshIntervalMs: number;
    timelogs: Array<{
        user: { username: string };
        spentAt: string;
        timeSpent: number;
        issue?: {
            title?: string;
            labels?: { nodes: Array<{ title: string }> };
        } | null;
    }>;
    onToggleAutoRefresh: () => void;
}

export const DashboardContext = createContext<DashboardToolbarState | null>(null);

export function useDashboardContext() {
    return useContext(DashboardContext);
}
