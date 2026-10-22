'use client';

import React from 'react';
import { Issue, Timelog } from '@/types/dashboard';
import { CATEGORIES, COLORS } from '@/config/dashboardConfig';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line,
} from 'recharts';
import {
    format, differenceInDays, eachWeekOfInterval, parseISO,
    startOfWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';

interface CategoryDashboardProps {
    issues: Issue[];
    timelogs: Timelog[];
}

const CATEGORY_VALUES = Object.values(CATEGORIES) as string[];

function getMainCategory(issue: Issue): string {
    return issue.labels?.nodes?.find(l => CATEGORY_VALUES.includes(l.title))?.title ?? '';
}

// ── data builders ────────────────────────────────────────────────────────────

function buildSpentByCategory(timelogs: Timelog[]) {
    if (!timelogs.length) return { data: [], categories: [] as string[] };
    const byWeek = new Map<string, Record<string, number>>();

    timelogs.forEach(log => {
        const weekStart = startOfWeek(parseISO(log.spentAt), { weekStartsOn: 1 });
        const weekKey = format(weekStart, "'KW' II/yy", { locale: de });
        const raw = log.issue?.labels?.nodes?.find(l => CATEGORY_VALUES.includes(l.title))?.title ?? '';
        const cat = raw.replace('category::', '') || 'Sonstige';
        if (!byWeek.has(weekKey)) byWeek.set(weekKey, {});
        const row = byWeek.get(weekKey)!;
        row[cat] = (row[cat] ?? 0) + log.timeSpent / 3600;
    });

    const data = Array.from(byWeek.entries())
        .sort((a, b) => {
            const parse = (s: string) => {
                const parts = s.split(' ');
                const [kw, yr] = parts[1].split('/');
                return Number(yr) * 100 + Number(kw);
            };
            return parse(a[0]) - parse(b[0]);
        })
        .map(([week, values]) => ({ week, ...values }));

    const allCats = [...Object.values(CATEGORIES).map(c => c.replace('category::', '')), 'Sonstige'];
    const categories = allCats.filter(c => data.some(d => (d as Record<string, unknown>)[c]));
    return { data, categories };
}

function buildBurndown(issues: Issue[]) {
    if (!issues.length) return [];
    const dates = issues.map(i => parseISO(i.createdAt));
    const earliest = dates.reduce((a, b) => a < b ? a : b);
    const weeks = eachWeekOfInterval({ start: earliest, end: new Date() });
    return weeks.map(weekStart => {
        const label = format(weekStart, "'KW' II/yy", { locale: de });
        const opened = issues.filter(i => parseISO(i.createdAt) <= weekStart).length;
        const closed = issues.filter(i => i.closedAt && parseISO(i.closedAt) <= weekStart).length;
        return { week: label, opened, closed };
    });
}

function buildCycleTime(issues: Issue[]) {
    const closed = issues.filter(i => i.state === 'closed' && i.closedAt && i.createdAt);
    const byCategory: Record<string, number[]> = {};
    closed.forEach(i => {
        const cat = getMainCategory(i).replace('category::', '') || 'Sonstige';
        const days = differenceInDays(parseISO(i.closedAt!), parseISO(i.createdAt));
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(days);
    });
    return Object.entries(byCategory).map(([category, days]) => ({
        category,
        avgDays: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
        count: days.length,
    })).sort((a, b) => b.avgDays - a.avgDays);
}

function buildCategoryIssueCount(issues: Issue[]) {
    return CATEGORY_VALUES.map(cat => {
        const catIssues = issues.filter(i => getMainCategory(i) === cat);
        return {
            category: cat.replace('category::', ''),
            opened: catIssues.filter(i => i.state === 'opened').length,
            closed: catIssues.filter(i => i.state === 'closed').length,
            total: catIssues.length,
        };
    }).filter(c => c.total > 0);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CategoryDashboard({ issues, timelogs }: CategoryDashboardProps) {
    const spentByCategory = buildSpentByCategory(timelogs);
    const burndown        = buildBurndown(issues);
    const cycleTime       = buildCycleTime(issues);
    const catIssueCounts  = buildCategoryIssueCount(issues);

    return (
        <div id="kategorie-analyse" className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Kategorie-Analyse</h2>

            <div className="grid grid-cols-1 gap-10">

                {/* 1 — Burndown cumulative */}
                {burndown.length > 1 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Burndown — kumulativer Verlauf</h3>
                        <p className="text-xs text-gray-400 mb-3">Gesamtzahl geöffneter und geschlossener Issues über Zeit</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={burndown}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                                    formatter={(v: number, n: string) => [v, n === 'opened' ? 'Geöffnet' : 'Geschlossen']}
                                />
                                <Legend formatter={n => n === 'opened' ? 'Geöffnet' : 'Geschlossen'} />
                                <Line type="monotone" dataKey="opened" stroke="#ef4444" strokeWidth={2} dot={false} name="opened" />
                                <Line type="monotone" dataKey="closed" stroke="#22c55e" strokeWidth={2} dot={false} name="closed" />
                            </LineChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* 2 — Spent time per category per week */}
                {spentByCategory.data.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Gebuchte Stunden pro Kategorie (wöchentlich)</h3>
                        <p className="text-xs text-gray-400 mb-3">Aufwand pro Kategorie über Zeit — gestapelt</p>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={spentByCategory.data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                                <YAxis unit="h" tick={{ fontSize: 11 }} />
                                <Tooltip
                                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                                    formatter={(v: number, name: string) => [`${v.toFixed(1)}h`, name]}
                                />
                                <Legend />
                                {spentByCategory.categories.map(cat => {
                                    const fullKey = `category::${cat}` as keyof typeof COLORS.CATEGORY;
                                    const color = COLORS.CATEGORY[fullKey] ?? '#94a3b8';
                                    return <Bar key={cat} dataKey={cat} stackId="a" fill={color} name={cat} />;
                                })}
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* 3 — Issues per category: open vs closed */}
                {catIssueCounts.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Issues pro Kategorie — Offen vs. Geschlossen</h3>
                        <p className="text-xs text-gray-400 mb-3">Gesamtstand aller Issues je Kategorie</p>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={catIssueCounts}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip
                                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                                    formatter={(v: number, name: string) => [v, name === 'opened' ? 'Offen' : 'Geschlossen']}
                                />
                                <Legend formatter={n => n === 'opened' ? 'Offen' : 'Geschlossen'} />
                                <Bar dataKey="opened" fill="#ef4444" name="opened" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="closed" fill="#22c55e" name="closed" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* 4 — Cycle time per category */}
                {cycleTime.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Ø Bearbeitungszeit pro Kategorie</h3>
                        <p className="text-xs text-gray-400 mb-3">Tage von Erstellung bis Schließung — nur geschlossene Issues</p>
                        <ResponsiveContainer width="100%" height={Math.max(160, cycleTime.length * 44)}>
                            <BarChart data={cycleTime} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" unit=" Tage" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 11 }} />
                                <Tooltip
                                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                                    formatter={(v: number, _: string, p: any) => [`${v} Tage (${p.payload.count} Issues)`, 'Ø Bearbeitungszeit']}
                                />
                                <Bar dataKey="avgDays" fill="#6366f1" name="Ø Tage" radius={[0, 3, 3, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

            </div>
        </div>
    );
}
