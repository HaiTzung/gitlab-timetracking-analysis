'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Issue, Epic, Timelog, HeatmapData, ProjectMetrics } from '@/types/dashboard';
import { TimeWindow } from '@/context/DashboardContext';
import DetailedActivity from './DetailedActivity';
import IssueDashboard from './IssueDashboard';
import TimeSeriesCharts from './TimeSeriesCharts';
import TeamAndCategories from './TeamAndCategories';
import CategoryDashboard from './CategoryDashboard';

const SLIDES = [
    { id: 'detaillierte-aktivitat', label: 'Aktivität' },
    { id: 'issue-zeitanalyse',      label: 'Issues' },
    { id: 'zeitliche-entwicklung',  label: 'Zeitliche Entwicklung' },
    { id: 'team-kategorien',        label: 'Team & Kategorien' },
    { id: 'kategorie-analyse',      label: 'Kategorie-Analyse' },
];

export interface PresentationModeProps {
    onClose: () => void;
    // Data for section rendering
    timelogs: Timelog[];
    windowTimelogs: Timelog[];
    issues: Issue[];
    epics: Epic[];
    issueStatuses: Map<string, string>;
    heatmapData: HeatmapData[][];
    HEATMAP_COLORS: string[];
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
}

export default function PresentationMode(props: PresentationModeProps) {
    const { onClose } = props;
    const [slide, setSlide] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);
    const total = SLIDES.length;

    const prev = () => setSlide(s => Math.max(0, s - 1));
    const next = () => setSlide(s => Math.min(total - 1, s + 1));

    // Reset scroll when changing slides
    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0 });
    }, [slide]);

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
            else if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const prevLabel = slide > 0 ? SLIDES[slide - 1].label : null;
    const nextLabel = slide < total - 1 ? SLIDES[slide + 1].label : null;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">{SLIDES[slide].label}</h2>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
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
                            heatmapData={props.heatmapData}
                            HEATMAP_COLORS={props.HEATMAP_COLORS}
                            formatTime={props.formatTime}
                            timelogs={props.timelogs}
                            issues={props.issues}
                            timeWindow={props.timeWindow}
                            customStart={props.customStart}
                            customEnd={props.customEnd}
                            usernameToName={props.usernameToName}
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
                            usernameToName={props.usernameToName}
                        />
                    )}
                    {slide === 4 && (
                        <CategoryDashboard
                            issues={props.issues}
                            timelogs={props.timelogs}
                        />
                    )}
                </div>
            </div>

            {/* Bottom navigation bar */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50 gap-4">
                <button
                    onClick={prev}
                    disabled={slide === 0}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[8rem]"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="truncate">{prevLabel ?? ''}</span>
                </button>

                <span className="text-sm text-gray-500 shrink-0 tabular-nums">
                    {slide + 1} / {total}
                </span>

                <button
                    onClick={next}
                    disabled={slide === total - 1}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[8rem] justify-end"
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
