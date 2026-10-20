'use client';

import { useEffect, useState } from 'react';
import { useDashboardContext, TimeWindow } from '@/context/DashboardContext';

const NAV_ITEMS = [
    { id: 'projektubersicht',       label: 'Projektübersicht' },
    { id: 'detaillierte-aktivitat', label: 'Detaillierte Aktivität' },
    { id: 'zeitliche-entwicklung',  label: 'Zeitliche Entwicklung' },
    { id: 'team-kategorien',        label: 'Team & Kategorien' },
    { id: 'produktivitatsanalyse',  label: 'Produktivitätsanalyse' },
    { id: 'team-zusammenarbeit',    label: 'Team Zusammenarbeit' },
    { id: 'issue-analyse',          label: 'Issue Analyse' },
    { id: 'issue-zeitanalyse',      label: 'Issues' },
    { id: 'kategorie-analyse',      label: 'Kategorie-Analyse' },
];

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

interface SidebarProps {
    open: boolean;
}

export default function Sidebar({ open }: SidebarProps) {
    const [activeId, setActiveId] = useState<string>('');
    const [customOpen, setCustomOpen] = useState(false);
    const [draftStart, setDraftStart] = useState('');
    const [draftEnd, setDraftEnd] = useState('');
    const ctx = useDashboardContext();
    const activeWindow = ctx?.timeWindow ?? 'all';

    useEffect(() => {
        if (!open) return;

        let rafId: number;
        let observers: IntersectionObserver[] = [];

        rafId = requestAnimationFrame(() => {
            const visibleSections = new Map<string, number>();

            NAV_ITEMS.forEach(({ id }) => {
                const el = document.getElementById(id);
                if (!el) return;
                const observer = new IntersectionObserver(
                    ([entry]) => {
                        if (entry.isIntersecting) {
                            visibleSections.set(id, entry.intersectionRatio);
                        } else {
                            visibleSections.delete(id);
                        }
                        if (visibleSections.size > 0) {
                            const topmost = [...visibleSections.entries()].reduce((a, b) =>
                                a[1] > b[1] ? a : b
                            );
                            setActiveId(topmost[0]);
                        }
                    },
                    { threshold: [0, 0.25, 0.5, 0.75, 1] }
                );
                observer.observe(el);
                observers.push(observer);
            });
        });

        return () => {
            cancelAnimationFrame(rafId);
            observers.forEach(o => o.disconnect());
        };
    }, [open]);

    const handlePreset = (w: TimeWindow) => {
        ctx?.onSetTimeWindow(w);
        if (w !== 'custom') setCustomOpen(false);
    };

    const handleCustomOpen = () => {
        setDraftStart(toInputDate(ctx?.customStart ?? null));
        setDraftEnd(toInputDate(ctx?.customEnd ?? null));
        setCustomOpen(true);
        ctx?.onSetTimeWindow('custom');
    };

    const handleCustomApply = () => {
        const start = draftStart ? new Date(draftStart) : null;
        const end = draftEnd ? new Date(draftEnd + 'T23:59:59') : null;
        ctx?.onSetCustomDates(start, end);
        setCustomOpen(false);
    };

    return (
        <aside
            className={`flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${
                open ? 'w-56' : 'w-0'
            }`}
        >
            <div className="w-56 flex flex-col h-full py-4">
                {/* Nav links */}
                <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Navigation
                </p>
                <nav className="flex flex-col gap-0.5 px-2 overflow-y-auto flex-1">
                    {NAV_ITEMS.map(({ id, label }) => (
                        <a
                            key={id}
                            href={`#${id}`}
                            className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                                activeId === id
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                activeId === id ? 'bg-blue-600' : 'bg-gray-300'
                            }`} />
                            <span className="whitespace-nowrap">{label}</span>
                        </a>
                    ))}
                </nav>

                {/* Time window — pinned to bottom */}
                <div className="px-3 pt-3 border-t border-gray-200 mt-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                        Zeitfenster
                    </p>
                    <div className="flex flex-col gap-0.5">
                        {PRESETS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => handlePreset(p.value)}
                                className={`w-full flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors text-left ${
                                    activeWindow === p.value
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    activeWindow === p.value ? 'bg-blue-600' : 'bg-gray-300'
                                }`} />
                                {p.label}
                            </button>
                        ))}
                        <button
                            onClick={handleCustomOpen}
                            className={`w-full flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors text-left ${
                                activeWindow === 'custom'
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                activeWindow === 'custom' ? 'bg-blue-600' : 'bg-gray-300'
                            }`} />
                            Benutzerdefiniert
                        </button>
                    </div>

                    {customOpen && (
                        <div className="mt-2 flex flex-col gap-1.5">
                            <input
                                type="date"
                                value={draftStart}
                                onChange={e => setDraftStart(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="date"
                                value={draftEnd}
                                onChange={e => setDraftEnd(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-1.5">
                                <button
                                    onClick={handleCustomApply}
                                    className="flex-1 bg-blue-600 text-white rounded-md px-2 py-1 text-xs font-medium hover:bg-blue-700 transition-colors"
                                >
                                    Übernehmen
                                </button>
                                <button
                                    onClick={() => { setCustomOpen(false); ctx?.onSetTimeWindow('all'); }}
                                    className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
