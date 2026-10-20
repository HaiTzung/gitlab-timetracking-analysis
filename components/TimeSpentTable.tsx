'use client';

import React, { useState, useEffect } from 'react';
import { startOfWeek, endOfWeek, addWeeks, format, parseISO, differenceInWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { Timelog } from '@/types/dashboard';
import { CATEGORIES, COLORS } from '@/config/dashboardConfig';

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

    // Always include every known user, even those with no logs in the current period
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

function buildShareUrl(weekOffset: number, showAll: boolean): string {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    if (showAll) return `${base}?week=all#zeitaufwand-tabelle`;
    const monday = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    return `${base}?week=${format(monday, 'yyyy-MM-dd')}#zeitaufwand-tabelle`;
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
    shareUrl: string,
): string {
    const col = (s: string, w: number) => s.padEnd(w);
    const colR = (s: string, w: number) => s.padStart(w);

    // Column widths
    const nameW = Math.max(6, ...users.map(u => u.length), 5 /* "Total" */);
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
        ...(shareUrl ? [`**Link:** ${shareUrl}`] : []),
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
    const [weekOffset, setWeekOffset] = useState(0);
    const [showAll, setShowAll] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const weekParam = params.get('week');
        if (!weekParam) return;
        if (weekParam === 'all') {
            setShowAll(true);
            requestAnimationFrame(() => {
                document.getElementById('zeitaufwand-tabelle')?.scrollIntoView({ behavior: 'smooth' });
            });
            return;
        }
        const targetDate = parseISO(weekParam);
        if (isNaN(targetDate.getTime())) return;
        const targetMonday = startOfWeek(targetDate, { weekStartsOn: 1 });
        const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
        const diff = differenceInWeeks(targetMonday, currentMonday);
        setWeekOffset(diff);
        setShowAll(false);
        requestAnimationFrame(() => {
            document.getElementById('zeitaufwand-tabelle')?.scrollIntoView({ behavior: 'smooth' });
        });
    }, []);

    const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const filtered = showAll
        ? timelogs
        : timelogs.filter(log => {
            const d = parseISO(log.spentAt);
            return d >= weekStart && d <= weekEnd;
        });

    const allUsers = [...new Set(timelogs.map(t => t.user.name))].sort();

    const { users, categories, data, rowTotals, colTotals, grandTotal } = buildMatrix(filtered, allUsers);

    const kwLabel = format(weekStart, "'KW' II", { locale: de });
    const rangeLabel = showAll
        ? (() => {
            if (!timelogs.length) return 'Keine Daten';
            const dates = timelogs.map(t => parseISO(t.spentAt));
            const earliest = dates.reduce((a, b) => a < b ? a : b);
            const latest = dates.reduce((a, b) => a > b ? a : b);
            return `${format(earliest, 'dd.MM.yyyy')} – ${format(latest, 'dd.MM.yyyy')}`;
        })()
        : `${format(weekStart, 'EEE, dd.MM.', { locale: de })} – ${format(weekEnd, 'EEE, dd.MM.yyyy', { locale: de })}`;

    const timeLabel = showAll ? 'Gesamter Zeitraum' : kwLabel;

    const handleExportMarkdown = () => {
        if (users.length === 0) return;
        const md = buildMarkdown(users, categories, data, rowTotals, colTotals, grandTotal, timeLabel, rangeLabel, buildShareUrl(weekOffset, showAll));
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zeitaufwand-${showAll ? 'gesamt' : kwLabel.replace(' ', '-')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCopyMarkdown = () => {
        if (users.length === 0) return;
        const md = buildMarkdown(users, categories, data, rowTotals, colTotals, grandTotal, timeLabel, rangeLabel, buildShareUrl(weekOffset, showAll));
        navigator.clipboard.writeText(md).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <section id="zeitaufwand-tabelle">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Zeitaufwand pro Person & Kategorie</h3>
            <p className="text-xs text-gray-400 mb-3">Gebuchte Stunden nach Teammitglied und Kategorie</p>

            {/* Week picker */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { setWeekOffset(w => w - 1); setShowAll(false); }}
                        disabled={showAll}
                        className="rounded-md px-2 py-1 text-sm border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Vorherige Woche"
                    >
                        ←
                    </button>

                    <div className="min-w-[220px] text-center px-3 py-1 rounded-md border border-gray-200 bg-white">
                        {showAll ? (
                            <span className="text-sm font-medium text-gray-800">Gesamter Zeitraum</span>
                        ) : (
                            <span className="text-sm font-medium text-gray-800">{kwLabel}</span>
                        )}
                        <span className="block text-xs text-gray-400">{rangeLabel}</span>
                    </div>

                    <button
                        onClick={() => { setWeekOffset(w => w + 1); setShowAll(false); }}
                        disabled={weekOffset >= 0 || showAll}
                        className="rounded-md px-2 py-1 text-sm border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Nächste Woche"
                    >
                        →
                    </button>
                </div>

                <button
                    onClick={() => { setWeekOffset(0); setShowAll(false); }}
                    className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${
                        !showAll && weekOffset === 0
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    Aktuelle Woche
                </button>

                <button
                    onClick={() => setShowAll(true)}
                    className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${
                        showAll
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    Gesamter Zeitraum
                </button>

                <div className="flex-1" />

                <button
                    onClick={handleCopyMarkdown}
                    disabled={users.length === 0}
                    className="rounded-md px-3 py-1 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {copied ? '✓ Kopiert' : '⎘ Kopieren'}
                </button>

                <button
                    onClick={handleExportMarkdown}
                    disabled={users.length === 0}
                    className="rounded-md px-3 py-1 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    ⬇ Markdown
                </button>
            </div>

            {/* Table */}
            {users.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                    Keine gebuchten Stunden in diesem Zeitraum.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Person
                                </th>
                                {categories.map(cat => (
                                    <th key={cat} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        <span className="flex items-center justify-end gap-1.5">
                                            <span
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: getCatColor(cat) }}
                                            />
                                            {cat}
                                        </span>
                                    </th>
                                ))}
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {users.map((user, i) => (
                                <tr key={user} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-2.5 text-gray-800 font-medium whitespace-nowrap">
                                        {user}
                                    </td>
                                    {categories.map(cat => {
                                        const val = data.get(user)?.get(cat) ?? 0;
                                        return (
                                            <td key={cat} className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                                                {val > 0
                                                    ? <span className="text-gray-800">{fmt(val)}</span>
                                                    : <span className="text-gray-300">–</span>
                                                }
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">
                                        {fmt(rowTotals.get(user) ?? 0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100 border-t border-gray-200">
                                <td className="px-4 py-2.5 font-semibold text-gray-700">
                                    Total
                                </td>
                                {categories.map(cat => (
                                    <td key={cat} className="px-4 py-2.5 text-right font-semibold text-gray-700 tabular-nums whitespace-nowrap">
                                        {fmt(colTotals.get(cat) ?? 0)}
                                    </td>
                                ))}
                                <td className="px-4 py-2.5 text-right font-bold text-blue-700 bg-blue-50 tabular-nums whitespace-nowrap">
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
