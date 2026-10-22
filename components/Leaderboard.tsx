'use client';

import React, { useState } from 'react';
import { Issue, Timelog } from '@/types/dashboard';

interface LeaderboardProps {
    timelogs: Timelog[];
    issues: Issue[];
    teamMembers: string[];
    usernameToName: Record<string, string>;
}

type SortKey = 'hours' | 'issuesWorked' | 'issuesCreated' | 'issuesClosed';

export default function Leaderboard({ timelogs, issues, teamMembers, usernameToName }: LeaderboardProps) {
    const [sortKey, setSortKey] = useState<SortKey>('hours');
    const [sortAsc, setSortAsc] = useState(false);

    const totalHours = timelogs.reduce((s, t) => s + t.timeSpent, 0) / 3600;
    const totalIssues = issues.length;
    const totalCreated = issues.length;
    const totalClosed = issues.filter(i => i.state === 'closed').length;

    const rows = teamMembers.map(username => {
        const displayName = usernameToName[username] ?? username;
        const userLogs = timelogs.filter(t => t.user.username === username);
        const hours = userLogs.reduce((s, t) => s + t.timeSpent, 0) / 3600;
        const workedIids = new Set(userLogs.map(t => t.issue?.iid).filter(Boolean));
        const issuesWorked = workedIids.size;
        const issuesCreated = issues.filter(i => i.author?.username === username).length;
        const issuesClosed = issues.filter(i =>
            i.state === 'closed' && i.assignees.nodes.some(a => a.username === username)
        ).length;
        return { username, displayName, hours, issuesWorked, issuesCreated, issuesClosed };
    });

    const sorted = [...rows].sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortAsc ? diff : -diff;
    });

    const pct = (val: number, total: number) =>
        total === 0 ? '–' : `${Math.round((val / total) * 100)}%`;

    const fmt = (n: number) => n.toFixed(1).replace('.', ',');

    const handleSort = (key: SortKey) => {
        if (key === sortKey) setSortAsc(a => !a);
        else { setSortKey(key); setSortAsc(false); }
    };

    const ColHeader = ({ k, label }: { k: SortKey; label: string }) => (
        <th
            onClick={() => handleSort(k)}
            className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800 dark:hover:text-gray-100 whitespace-nowrap"
        >
            {label}
            {sortKey === k && (
                <span className="ml-1 text-gray-400 dark:text-gray-500">{sortAsc ? '↑' : '↓'}</span>
            )}
        </th>
    );

    return (
        <div id="leaderboard" className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">Leaderboard</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">Klicke auf eine Spalte zum Sortieren · % = Anteil am Gesamtprojekt</p>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">#</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Person</th>
                            <ColHeader k="hours" label="Stunden" />
                            <ColHeader k="issuesWorked" label="Issues bearbeitet" />
                            <ColHeader k="issuesCreated" label="Issues erstellt" />
                            <ColHeader k="issuesClosed" label="Issues geschlossen" />
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row, i) => (
                            <tr
                                key={row.username}
                                className={`border-b border-gray-100 dark:border-gray-700 ${i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'} hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors`}
                            >
                                <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">{i + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{row.displayName}</td>
                                <td className="px-4 py-3 tabular-nums">
                                    <div className="flex items-center justify-end gap-0">
                                        <span className="font-semibold text-gray-800 dark:text-gray-100 text-right min-w-[3.5rem]">{fmt(row.hours)}h</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 text-right w-10">{pct(row.hours, totalHours)}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 tabular-nums">
                                    <div className="flex items-center justify-end gap-0">
                                        <span className="font-semibold text-gray-800 dark:text-gray-100 text-right min-w-[3.5rem]">{row.issuesWorked}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 text-right w-10">{pct(row.issuesWorked, totalIssues)}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 tabular-nums">
                                    <div className="flex items-center justify-end gap-0">
                                        <span className="font-semibold text-gray-800 dark:text-gray-100 text-right min-w-[3.5rem]">{row.issuesCreated}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 text-right w-10">{pct(row.issuesCreated, totalCreated)}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 tabular-nums">
                                    <div className="flex items-center justify-end gap-0">
                                        <span className="font-semibold text-gray-800 dark:text-gray-100 text-right min-w-[3.5rem]">{row.issuesClosed}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 text-right w-10">{pct(row.issuesClosed, totalClosed)}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Gesamt</td>
                            <td className="px-4 py-3 tabular-nums"><div className="flex items-center justify-end"><span className="font-semibold text-gray-700 dark:text-gray-200 min-w-[3.5rem] text-right">{fmt(totalHours)}h</span><span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">100%</span></div></td>
                            <td className="px-4 py-3 tabular-nums"><div className="flex items-center justify-end"><span className="font-semibold text-gray-700 dark:text-gray-200 min-w-[3.5rem] text-right">{totalIssues}</span><span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">100%</span></div></td>
                            <td className="px-4 py-3 tabular-nums"><div className="flex items-center justify-end"><span className="font-semibold text-gray-700 dark:text-gray-200 min-w-[3.5rem] text-right">{totalCreated}</span><span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">100%</span></div></td>
                            <td className="px-4 py-3 tabular-nums"><div className="flex items-center justify-end"><span className="font-semibold text-gray-700 dark:text-gray-200 min-w-[3.5rem] text-right">{totalClosed}</span><span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">100%</span></div></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
