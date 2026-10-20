'use client';

import { createContext, useContext, useState, useCallback } from 'react';

export type TimeWindow = 'all' | '7d' | '14d' | 'month' | 'custom';

export interface DashboardToolbarState {
    lastRefreshed: Date | null;
    autoRefresh: boolean;
    refreshIntervalMs: number;
    timelogs: Array<{
        user: { name: string; username: string };
        spentAt: string;
        timeSpent: number;
        issue?: {
            title?: string;
            iid?: string;
            timeEstimate?: number;
            totalTimeSpent?: number;
            labels?: { nodes: Array<{ title: string }> };
        } | null;
    }>;
    onToggleAutoRefresh: () => void;
    timeWindow: TimeWindow;
    onSetTimeWindow: (w: TimeWindow) => void;
    customStart: Date | null;
    customEnd: Date | null;
    onSetCustomDates: (start: Date | null, end: Date | null) => void;
}

interface DashboardContextValue {
    state: DashboardToolbarState | null;
    setState: (s: DashboardToolbarState) => void;
}

export const DashboardContext = createContext<DashboardContextValue>({
    state: null,
    setState: () => {},
});

export function useDashboardContext() {
    return useContext(DashboardContext).state;
}

export function useDashboardContextSetter() {
    return useContext(DashboardContext).setState;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
    const [state, setStateRaw] = useState<DashboardToolbarState | null>(null);
    const setState = useCallback((s: DashboardToolbarState) => setStateRaw(s), []);
    return (
        <DashboardContext.Provider value={{ state, setState }}>
            {children}
        </DashboardContext.Provider>
    );
}
