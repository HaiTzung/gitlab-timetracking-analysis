'use client';

import { useDashboardContext } from '@/context/DashboardContext';

interface TitleBarProps {
    onMenuToggle: () => void;
    projectName: string;
}

export default function TitleBar({ onMenuToggle, projectName }: TitleBarProps) {
    const ctx = useDashboardContext();

    const handleCsvExport = () => {
        if (!ctx) return;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recent = ctx.timelogs.filter(t =>
            t.spentAt && new Date(t.spentAt) >= sevenDaysAgo
        );

        const header = 'Benutzer,Anzeigename,Datum,Stunden,Issue-Nr,Issue-Titel,Kategorie,Geschätzt (h),Gesamt gebucht (h)\n';
        const rows = recent
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
        a.download = `timelogs-last7days-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <header className="flex-shrink-0 h-14 bg-white border-b border-gray-200 shadow-sm flex items-center px-4 gap-4 z-20">
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

            <h1 className="text-base font-semibold text-gray-800 tracking-tight flex-1">
                {projectName}
            </h1>

            {ctx && (
                <div className="flex items-center gap-3 text-sm">
                    {ctx.lastRefreshed && (
                        <span className="text-gray-400 text-xs hidden sm:block">
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
        </header>
    );
}
