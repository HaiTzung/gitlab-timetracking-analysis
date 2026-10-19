'use client';

import { useEffect, useState } from 'react';

const NAV_ITEMS = [
    { id: 'projektubersicht',       label: 'Projektübersicht',      icon: '📊' },
    { id: 'detaillierte-aktivitat', label: 'Detaillierte Aktivität', icon: '🗓️' },
    { id: 'zeitliche-entwicklung',  label: 'Zeitliche Entwicklung',  icon: '📈' },
    { id: 'team-kategorien',        label: 'Team & Kategorien',      icon: '🥧' },
    { id: 'produktivitatsanalyse',  label: 'Produktivitätsanalyse',  icon: '⏰' },
    { id: 'team-zusammenarbeit',    label: 'Team Zusammenarbeit',    icon: '🤝' },
    { id: 'issue-analyse',          label: 'Issue Analyse',          icon: '🔍' },
    { id: 'issue-zeitanalyse',      label: 'Issue Zeitanalyse',      icon: '⚖️' },
];

interface SidebarProps {
    open: boolean;
}

export default function Sidebar({ open }: SidebarProps) {
    const [activeId, setActiveId] = useState<string>('');

    useEffect(() => {
        const observers: IntersectionObserver[] = [];
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

        return () => observers.forEach(o => o.disconnect());
    }, []);

    return (
        <aside
            className={`flex-shrink-0 bg-gray-900 text-white flex flex-col overflow-hidden transition-all duration-300 ${
                open ? 'w-64' : 'w-0'
            }`}
        >
            <div className="w-64 flex flex-col h-full py-4">
                <p className="px-4 mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Navigation
                </p>
                <nav className="flex flex-col gap-1 px-2 overflow-y-auto flex-1">
                    {NAV_ITEMS.map(({ id, label, icon }) => (
                        <a
                            key={id}
                            href={`#${id}`}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                                activeId === id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            <span className="text-base">{icon}</span>
                            <span className="whitespace-nowrap">{label}</span>
                        </a>
                    ))}
                </nav>
            </div>
        </aside>
    );
}
