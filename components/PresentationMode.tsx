'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Issue, Epic, Timelog, ProjectMetrics } from '@/types/dashboard';
import { TimeWindow } from '@/context/DashboardContext';
import { eachWeekOfInterval, startOfWeek, endOfWeek, parseISO, format } from 'date-fns';
import { de } from 'date-fns/locale';
import DetailedActivity from './DetailedActivity';
import IssueDashboard from './IssueDashboard';
import TimeSeriesCharts from './TimeSeriesCharts';
import TeamAndCategories from './TeamAndCategories';

const SLIDES = [
    { id: 'detaillierte-aktivitat', label: 'Aktivität' },
    { id: 'issue-zeitanalyse',      label: 'Issues' },
    { id: 'zeitliche-entwicklung',  label: 'Zeitliche Entwicklung' },
    { id: 'team-kategorien',        label: 'Team & Kategorien' },
];

export interface PresentationModeProps {
    onClose: () => void;
    // Data for section rendering
    timelogs: Timelog[];
    windowTimelogs: Timelog[];
    issues: Issue[];
    epics: Epic[];
    issueStatuses: Map<string, string>;
    formatTime: (seconds: number) => string;
    projectMetrics: ProjectMetrics;
    lineData: Record<string, string | number>[];
    barData: Array<{ name: string; value: number }>;
    pieData: Array<{ name: string; value: number }>;
    COLORS: string[];
    TEAM_COLORS: string[];
    userLastLogged: Record<string, string | null>;
    teamMembers: string[];
    selectedCategory: string | null;
    onCategorySelect: (cat: string | null) => void;
    usernameToName: Record<string, string>;
    timeWindow: TimeWindow;
    customStart: Date | null;
    customEnd: Date | null;
    onSetTimeWindow?: (w: TimeWindow) => void;
    onSetCustomDates?: (start: Date | null, end: Date | null) => void;
}

export default function PresentationMode(props: PresentationModeProps) {
    const { onClose } = props;
    const [slide, setSlide] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const total = SLIDES.length;

    const prev = () => setSlide(s => Math.max(0, s - 1));
    const next = () => setSlide(s => Math.min(total - 1, s + 1));

    const kwOptions = useMemo(() => {
        const logs = props.timelogs;
        if (!logs.length) return [];
        const earliest = logs.reduce((min, t) => (t.spentAt < min ? t.spentAt : min), logs[0].spentAt);
        const start = startOfWeek(parseISO(earliest), { weekStartsOn: 1 });
        const end = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
        const todayStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);
        return weeks.map((weekStart) => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
            const isCurrent = weekStart.toISOString().slice(0, 10) === todayStart;
            const base = `KW ${format(weekStart, 'II/yy', { locale: de })} (${format(weekStart, 'dd.MM', { locale: de })}–${format(weekEnd, 'dd.MM', { locale: de })})`;
            return { label: isCurrent ? `${base} · diese Woche` : base, weekStart, weekEnd };
        }).reverse();
    }, [props.timelogs]);

    const selectedKwIndex = useMemo(() => {
        if (props.timeWindow !== 'kw' || !props.customStart) return '';
        const startStr = props.customStart.toISOString().slice(0, 10);
        const idx = kwOptions.findIndex(opt => opt.weekStart.toISOString().slice(0, 10) === startStr);
        return idx >= 0 ? String(idx) : '';
    }, [props.timeWindow, props.customStart, kwOptions]);

    const handleKwChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '') {
            props.onSetTimeWindow?.('all');
            props.onSetCustomDates?.(null, null);
            return;
        }
        const idx = Number(val);
        const { weekStart, weekEnd } = kwOptions[idx];
        props.onSetTimeWindow?.('kw');
        props.onSetCustomDates?.(weekStart, new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59));
    };

    // Enter fullscreen on mount, exit on unmount
    useEffect(() => {
        const el = containerRef.current;
        if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
        const onFsChange = () => {
            if (!document.fullscreenElement) onClose();
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset scroll when changing slides
    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0 });
    }, [slide]);

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const prevLabel = slide > 0 ? SLIDES[slide - 1].label : null;
    const nextLabel = slide < total - 1 ? SLIDES[slide + 1].label : null;

    return (
        <div ref={containerRef} className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 shrink-0">{SLIDES[slide].label}</h2>

                {/* KW picker */}
                <div className="relative mx-4 flex-1 max-w-xs">
                    <select
                        value={selectedKwIndex}
                        onChange={handleKwChange}
                        className="w-full appearance-none border border-gray-300 dark:border-gray-600 rounded-md pl-2 pr-7 py-1.5 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Alle Wochen</option>
                        {kwOptions.map((opt, idx) => (
                            <option key={idx} value={idx}>{opt.label}</option>
                        ))}
                    </select>
                    <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 4l4 4 4-4" />
                    </svg>
                </div>

                <button
                    onClick={() => document.exitFullscreen().catch(() => onClose())}
                    className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors shrink-0"
                    aria-label="Präsentation beenden"
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            {/* Scrollable section content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-6">
                {/* Each section re-mounts on slide change via key, ensuring collapsed state resets */}
                <div key={slide}>
                    {slide === 0 && (
                        <DetailedActivity
                            formatTime={props.formatTime}
                            timelogs={props.timelogs}
                            issues={props.issues}
                            timeWindow={props.timeWindow}
                            customStart={props.customStart}
                            customEnd={props.customEnd}
                            usernameToName={props.usernameToName}
                            projectMetrics={props.projectMetrics}
                            COLORS={props.COLORS}
                            lineData={props.lineData}
                            barData={props.barData}
                            TEAM_COLORS={props.TEAM_COLORS}
                        />
                    )}
                    {slide === 1 && (
                        <IssueDashboard
                            issues={props.issues}
                            epics={props.epics}
                            issueStatuses={props.issueStatuses}
                            defaultExpanded={false}
                        />
                    )}
                    {slide === 2 && (
                        <TimeSeriesCharts
                            projectMetrics={props.projectMetrics}
                            lineData={props.lineData}
                            barData={props.barData}
                            TEAM_COLORS={props.TEAM_COLORS}
                            COLORS={props.COLORS}
                            issues={props.issues}
                            timelogs={props.timelogs}
                        />
                    )}
                    {slide === 3 && (
                        <TeamAndCategories
                            pieData={props.pieData}
                            barData={props.barData}
                            COLORS={props.COLORS}
                            userLastLogged={props.userLastLogged}
                            teamMembers={props.teamMembers}
                            selectedCategory={props.selectedCategory}
                            onCategorySelect={props.onCategorySelect}
                            timelogs={props.windowTimelogs}
                            allTimelogs={props.timelogs}
                            usernameToName={props.usernameToName}
                        />
                    )}
                </div>
            </div>

            {/* Bottom navigation bar */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 gap-4">
                <button
                    onClick={prev}
                    disabled={slide === 0}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[8rem]"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="truncate">{prevLabel ?? ''}</span>
                </button>

                <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
                    {slide + 1} / {total}
                </span>

                <button
                    onClick={next}
                    disabled={slide === total - 1}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[8rem] justify-end"
                >
                    <span className="truncate">{nextLabel ?? ''}</span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
