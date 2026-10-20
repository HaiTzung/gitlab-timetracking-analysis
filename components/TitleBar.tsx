'use client';

import { useState } from 'react';
import { useDashboardContext, TimeWindow } from '@/context/DashboardContext';

interface TitleBarProps {
    onMenuToggle: () => void;
    projectName: string;
}

const PRESETS: { label: string; value: TimeWindow }[] = [
    { label: 'Alle', value: 'all' },
    { label: '7 Tage', value: '7d' },
    { label: '14 Tage', value: '14d' },
    { label: 'Monat', value: 'month' },
];

function toInputDate(d: Date | null): string {
    if (!d) return '';
    return d.toISOString().slice(0, 10);
}

function formatWindowLabel(window: TimeWindow, customStart: Date | null, customEnd: Date | null): string {
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const now = new Date();
    if (window === '7d')    return `${fmt(new Date(now.getTime() - 7 * 86400000))} – ${fmt(now)}`;
    if (window === '14d')   return `${fmt(new Date(now.getTime() - 14 * 86400000))} – ${fmt(now)}`;
    if (window === 'month') return `${fmt(new Date(now.getFullYear(), now.getMonth(), 1))} – ${fmt(now)}`;
    if (window === 'custom' && customStart) return `${fmt(customStart)} – ${customEnd ? fmt(customEnd) : fmt(now)}`;
    return '';
}

export default function TitleBar({ onMenuToggle, projectName }: TitleBarProps) {
    const ctx = useDashboardContext();
    const [customOpen, setCustomOpen] = useState(false);
    const [draftStart, setDraftStart] = useState('');
    const [draftEnd, setDraftEnd] = useState('');
    const [localWindow, setLocalWindow] = useState<TimeWindow>('all');

    const activeWindow = ctx?.timeWindow ?? localWindow;

    const handlePreset = (w: TimeWindow) => {
        setLocalWindow(w);
        ctx?.onSetTimeWindow(w);
        if (w !== 'custom') setCustomOpen(false);
    };

    const handleCustomOpen = () => {
        setDraftStart(toInputDate(ctx?.customStart ?? null));
        setDraftEnd(toInputDate(ctx?.customEnd ?? null));
        setCustomOpen(true);
        setLocalWindow('custom');
        ctx?.onSetTimeWindow('custom');
    };

    const handleCustomApply = () => {
        const start = draftStart ? new Date(draftStart) : null;
        const end = draftEnd ? new Date(draftEnd + 'T23:59:59') : null;
        ctx?.onSetCustomDates(start, end);
        setCustomOpen(false);
    };

    const handleCsvExport = () => {
        if (!ctx) return;

        const { timeWindow, customStart, customEnd } = ctx;
        const now = new Date();
        let from: Date | null = null;
        let to: Date = now;

        if (timeWindow === '7d')       from = new Date(now.getTime() - 7 * 86400000);
        else if (timeWindow === '14d') from = new Date(now.getTime() - 14 * 86400000);
        else if (timeWindow === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); }
        else if (timeWindow === 'custom') { from = customStart; if (customEnd) to = customEnd; }

        const filtered = ctx.timelogs.filter(t => {
            const d = new Date(t.spentAt);
            return (!from || d >= from) && d <= to;
        });

        const header = 'Benutzer,Anzeigename,Datum,Stunden,Issue-Nr,Issue-Titel,Kategorie,Geschätzt (h),Gesamt gebucht (h)\n';
        const rows = filtered
            .sort((a, b) => a.spentAt.localeCompare(b.spentAt))
            .map(t => {
                const category = t.issue?.labels?.nodes?.find(l => l.title.startsWith('category::'))?.title ?? '';
                const hours = (t.timeSpent / 3600).toFixed(2);
                const date = t.spentAt.slice(0, 10);
                const title = (t.issue?.title ?? '').replace(/"/g, '""');
                const iid = t.issue?.iid ?? '';
                const estimated = t.issue?.timeEstimate ? (t.issue.timeEstimate / 3600).toFixed(2) : '';
                const totalSpent = t.issue?.totalTimeSpent ? (t.issue.totalTimeSpent / 3600).toFixed(2) : '';
                return `"${t.user.username}","${t.user.name}","${date}","${hours}","${iid}","${title}","${category}","${estimated}","${totalSpent}"`;
            }).join('\n');

        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timelogs-${timeWindow}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <header className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm z-20">
            {/* Main bar */}
            <div className="h-14 flex items-center px-4 gap-4">
                <button
                    onClick={onMenuToggle}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                    aria-label="Toggle navigation"
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <rect x="2" y="4" width="16" height="2" rx="1" />
                        <rect x="2" y="9" width="16" height="2" rx="1" />
                        <rect x="2" y="14" width="16" height="2" rx="1" />
                    </svg>
                </button>

                <h1 className="text-base font-semibold text-gray-800 tracking-tight">
                    {projectName}
                </h1>

                {/* Time window presets — always visible */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 ml-4">
                    {PRESETS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => handlePreset(p.value)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                activeWindow === p.value
                                    ? 'bg-white text-gray-800 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        onClick={handleCustomOpen}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            activeWindow === 'custom'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        📅 Benutzerdefiniert
                    </button>
                </div>

                {activeWindow !== 'all' && (
                    <span className="text-xs text-gray-500 hidden sm:block">
                        {formatWindowLabel(activeWindow, ctx?.customStart ?? null, ctx?.customEnd ?? null)}
                    </span>
                )}

                <div className="flex-1" />

                {ctx && (
                    <div className="flex items-center gap-2 text-sm">
                        <div className="w-px h-5 bg-gray-200" />

                        {ctx.lastRefreshed && (
                            <span className="text-gray-400 text-xs hidden lg:block">
                                Zuletzt aktualisiert: {ctx.lastRefreshed.toLocaleTimeString('de-DE')}
                            </span>
                        )}

                        <button
                            onClick={handleCsvExport}
                            disabled={ctx.timelogs.length === 0}
                            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            ⬇ CSV Export
                        </button>

                        <button
                            onClick={ctx.onToggleAutoRefresh}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                ctx.autoRefresh
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {ctx.autoRefresh
                                ? `⏱ Auto-Refresh aktiv (${ctx.refreshIntervalMs / 60000} min)`
                                : '⏱ Auto-Refresh'}
                        </button>
                    </div>
                )}
            </div>

            {/* Custom date picker row */}
            {customOpen && (
                <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 bg-gray-50 text-sm">
                    <span className="text-xs text-gray-500 font-medium">Von</span>
                    <input
                        type="date"
                        value={draftStart}
                        onChange={e => setDraftStart(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500 font-medium">Bis</span>
                    <input
                        type="date"
                        value={draftEnd}
                        onChange={e => setDraftEnd(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleCustomApply}
                        className="bg-blue-600 text-white rounded-md px-3 py-1 text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                        Übernehmen
                    </button>
                    <button
                        onClick={() => { setCustomOpen(false); ctx?.onSetTimeWindow('all'); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                    >
                        Abbrechen
                    </button>
                </div>
            )}
        </header>
    );
}
