'use client';

import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Timelog } from '@/types/dashboard';
import { CATEGORIES, COLORS } from '@/config/dashboardConfig';
import { useDashboardContext } from '@/context/DashboardContext';

interface TimeSpentTableProps {
    timelogs: Timelog[];
}

const CATEGORY_VALUES = Object.values(CATEGORIES) as string[];

function buildMatrix(logs: Timelog[], allUsers: string[]) {
    const data = new Map<string, Map<string, number>>();

    logs.forEach(log => {
        const userName = log.user.name;
        const rawCat = log.issue?.labels?.nodes?.find(l => CATEGORY_VALUES.includes(l.title))?.title ?? '';
        const cat = rawCat.replace('category::', '') || 'Sonstige';
        const hours = log.timeSpent / 3600;

        if (!data.has(userName)) data.set(userName, new Map());
        const row = data.get(userName)!;
        row.set(cat, (row.get(cat) ?? 0) + hours);
    });

    const users = [...new Set([...allUsers, ...data.keys()])].sort();
    const allCats = [...Object.values(CATEGORIES).map(c => c.replace('category::', '')), 'Sonstige'];
    const categories = allCats.filter(cat => [...data.values()].some(row => row.has(cat)));

    const rowTotals = new Map(users.map(u => [
        u,
        [...(data.get(u)?.values() ?? [])].reduce((s, v) => s + v, 0),
    ]));
    const colTotals = new Map(categories.map(cat => [
        cat,
        users.reduce((s, u) => s + (data.get(u)?.get(cat) ?? 0), 0),
    ]));
    const grandTotal = [...rowTotals.values()].reduce((s, v) => s + v, 0);

    return { users, categories, data, rowTotals, colTotals, grandTotal };
}

function fmt(hours: number): string {
    return hours.toFixed(1) + 'h';
}

function getCatColor(strippedCat: string): string {
    const fullKey = `category::${strippedCat}` as keyof typeof COLORS.CATEGORY;
    return COLORS.CATEGORY[fullKey] ?? '#94a3b8';
}

function buildMarkdown(
    users: string[],
    categories: string[],
    data: Map<string, Map<string, number>>,
    rowTotals: Map<string, number>,
    colTotals: Map<string, number>,
    grandTotal: number,
    timeLabel: string,
    rangeLabel: string,
): string {
    const col = (s: string, w: number) => s.padEnd(w);
    const colR = (s: string, w: number) => s.padStart(w);

    const nameW = Math.max(6, ...users.map(u => u.length), 5);
    const catWs = categories.map(cat =>
        Math.max(cat.length, ...users.map(u => fmt(data.get(u)?.get(cat) ?? 0).length), fmt(colTotals.get(cat) ?? 0).length)
    );
    const totalW = Math.max(5, ...users.map(u => fmt(rowTotals.get(u) ?? 0).length), fmt(grandTotal).length);

    const sep = () =>
        `| ${'-'.repeat(nameW)} |` +
        catWs.map(w => ` ${'-'.repeat(w)} |`).join('') +
        ` ${'-'.repeat(totalW)} |`;

    const header =
        `| ${col('Person', nameW)} |` +
        categories.map((cat, i) => ` ${col(cat, catWs[i])} |`).join('') +
        ` ${col('Total', totalW)} |`;

    const rows = users.map(u =>
        `| ${col(u, nameW)} |` +
        categories.map((cat, i) => {
            const val = data.get(u)?.get(cat) ?? 0;
            return ` ${colR(val > 0 ? fmt(val) : '–', catWs[i])} |`;
        }).join('') +
        ` ${colR(fmt(rowTotals.get(u) ?? 0), totalW)} |`
    );

    const totalRow =
        `| ${col('Total', nameW)} |` +
        categories.map((cat, i) => ` ${colR(fmt(colTotals.get(cat) ?? 0), catWs[i])} |`).join('') +
        ` ${colR(fmt(grandTotal), totalW)} |`;

    const lines = [
        `## Zeitaufwand pro Person & Kategorie`,
        ``,
        `**Zeitraum:** ${timeLabel} (${rangeLabel})`,
        `**Exportiert:** ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })}`,
        ``,
        header,
        sep(),
        ...rows,
        sep(),
        totalRow,
    ];

    return lines.join('\n');
}

export default function TimeSpentTable({ timelogs }: TimeSpentTableProps) {
    const [copied, setCopied] = useState(false);
    const ctx = useDashboardContext();

    const isCustomRange = ctx?.timeWindow === 'custom' && !!(ctx.customStart || ctx.customEnd);

    const filtered = isCustomRange
        ? timelogs.filter(log => {
            const d = parseISO(log.spentAt);
            return (!ctx.customStart || d >= ctx.customStart) && (!ctx.customEnd || d <= ctx.customEnd);
        })
        : timelogs;

    const allUsers = [...new Set(timelogs.map(t => t.user.name))].sort();
    const { users, categories, data, rowTotals, colTotals, grandTotal } = buildMatrix(filtered, allUsers);

    const rangeLabel = isCustomRange
        ? (() => {
            const s = ctx?.customStart;
            const e = ctx?.customEnd;
            if (!s && !e) return 'Benutzerdefiniert';
            if (s && e) return `${format(s, 'dd.MM.yyyy')} – ${format(e, 'dd.MM.yyyy')}`;
            if (s) return `ab ${format(s, 'dd.MM.yyyy')}`;
            return `bis ${format(e!, 'dd.MM.yyyy')}`;
        })()
        : (() => {
            if (!timelogs.length) return 'Keine Daten';
            const dates = timelogs.map(t => parseISO(t.spentAt));
            const earliest = dates.reduce((a, b) => a < b ? a : b);
            const latest = dates.reduce((a, b) => a > b ? a : b);
            return `${format(earliest, 'dd.MM.yyyy')} – ${format(latest, 'dd.MM.yyyy')}`;
        })();

    const timeLabel = isCustomRange ? 'Benutzerdefiniert' : 'Gesamter Zeitraum';

    const handleExportMarkdown = () => {
        if (users.length === 0) return;
        const md = buildMarkdown(users, categories, data, rowTotals, colTotals, grandTotal, timeLabel, rangeLabel);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zeitaufwand-${isCustomRange ? 'benutzerdefiniert' : 'gesamt'}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCopyMarkdown = () => {
        if (users.length === 0) return;
        const md = buildMarkdown(users, categories, data, rowTotals, colTotals, grandTotal, timeLabel, rangeLabel);
        navigator.clipboard.writeText(md).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <section id="zeitaufwand-tabelle">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Zeitaufwand pro Person & Kategorie</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopyMarkdown}
                        disabled={users.length === 0}
                        className="rounded-md px-3 py-1 text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {copied ? '✓ Kopiert' : '⎘ Kopieren'}
                    </button>
                    <button
                        onClick={handleExportMarkdown}
                        disabled={users.length === 0}
                        className="rounded-md px-3 py-1 text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        ⬇ Markdown
                    </button>
                </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Gebuchte Stunden nach Teammitglied und Kategorie</p>

            {users.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                    Keine gebuchten Stunden in diesem Zeitraum.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                    Person
                                </th>
                                {categories.map(cat => (
                                    <th key={cat} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                        <span className="flex items-center justify-end gap-1.5">
                                            <span
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: getCatColor(cat) }}
                                            />
                                            {cat}
                                        </span>
                                    </th>
                                ))}
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider whitespace-nowrap">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-700">
                            {users.map((user, i) => (
                                <tr key={user} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}>
                                    <td className="px-4 py-2.5 text-gray-800 dark:text-gray-100 font-medium whitespace-nowrap">
                                        {user}
                                    </td>
                                    {categories.map(cat => {
                                        const val = data.get(user)?.get(cat) ?? 0;
                                        return (
                                            <td key={cat} className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                                                {val > 0
                                                    ? <span className="text-gray-800 dark:text-gray-100">{fmt(val)}</span>
                                                    : <span className="text-gray-300 dark:text-gray-600">–</span>
                                                }
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800 dark:text-gray-100 tabular-nums whitespace-nowrap">
                                        {fmt(rowTotals.get(user) ?? 0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                <td className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-200">
                                    Total
                                </td>
                                {categories.map(cat => (
                                    <td key={cat} className="px-4 py-2.5 text-right font-semibold text-gray-700 dark:text-gray-200 tabular-nums whitespace-nowrap">
                                        {fmt(colTotals.get(cat) ?? 0)}
                                    </td>
                                ))}
                                <td className="px-4 py-2.5 text-right font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 tabular-nums whitespace-nowrap">
                                    {fmt(grandTotal)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </section>
    );
}
