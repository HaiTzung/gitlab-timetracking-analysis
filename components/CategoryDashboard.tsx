'use client';

import React from 'react';
import { Issue, Timelog } from '@/types/dashboard';
import { CATEGORIES, COLORS, DEVIATION_THRESHOLDS } from '@/config/dashboardConfig';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, ScatterChart, Scatter, ReferenceLine, ZAxis, Cell,
} from 'recharts';
import {
    format, differenceInDays, eachWeekOfInterval, parseISO,
    startOfWeek, addDays,
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
            // Format is "KW 42/26" → split on space gives ["KW", "42/26"]
            const parse = (s: string) => {
                const parts = s.split(' '); // ["KW", "42/26"]
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

function buildWeeklyIssueVolume(issues: Issue[]) {
    if (!issues.length) return [];
    const dates = issues.map(i => parseISO(i.createdAt));
    const earliest = dates.reduce((a, b) => a < b ? a : b);
    const weeks = eachWeekOfInterval({ start: earliest, end: new Date() }, { weekStartsOn: 1 });
    return weeks.map(weekStart => {
        const weekEnd = addDays(weekStart, 6);
        const label = format(weekStart, "'KW' II/yy", { locale: de });
        const opened = issues.filter(i => { const d = parseISO(i.createdAt); return d >= weekStart && d <= weekEnd; }).length;
        const closed = issues.filter(i => { if (!i.closedAt) return false; const d = parseISO(i.closedAt); return d >= weekStart && d <= weekEnd; }).length;
        return { week: label, opened, closed };
    }).filter(w => w.opened > 0 || w.closed > 0);
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

function buildScatter(issues: Issue[]) {
    return issues
        .filter(i => i.state === 'closed' && i.timeEstimate > 0 && i.totalTimeSpent > 0)
        .map(i => ({
            estimated: parseFloat((i.timeEstimate / 3600).toFixed(2)),
            actual: parseFloat((i.totalTimeSpent / 3600).toFixed(2)),
            title: i.title,
            iid: i.iid,
        }));
}

function buildAging(issues: Issue[]) {
    const open = issues.filter(i => i.state === 'opened');
    const buckets = [
        { label: '< 1 Tag',   count: 0 },
        { label: '1–3 Tage',  count: 0 },
        { label: '4–7 Tage',  count: 0 },
        { label: '7–14 Tage', count: 0 },
        { label: '15–21 Tage',count: 0 },
        { label: '22–31 Tage',count: 0 },
        { label: '> 31 Tage', count: 0 },
    ];
    open.forEach(i => {
        const age = differenceInDays(new Date(), parseISO(i.createdAt));
        if (age < 1)        buckets[0].count++;
        else if (age <= 3)  buckets[1].count++;
        else if (age <= 7)  buckets[2].count++;
        else if (age <= 14) buckets[3].count++;
        else if (age <= 21) buckets[4].count++;
        else if (age <= 31) buckets[5].count++;
        else                buckets[6].count++;
    });
    return buckets;
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
    const weeklyVolume    = buildWeeklyIssueVolume(issues);
    const burndown        = buildBurndown(issues);
    const cycleTime       = buildCycleTime(issues);
    const scatter         = buildScatter(issues);
    const aging           = buildAging(issues);
    const catIssueCounts  = buildCategoryIssueCount(issues);
    const maxScatter      = Math.max(...scatter.map(d => Math.max(d.estimated, d.actual)), 1);

    return (
        <div id="kategorie-analyse" className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Kategorie-Analyse</h2>

            <div className="grid grid-cols-1 gap-10">

                {/* 1 — Spent time per category per week */}
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

                {/* 2 — Open vs closed issues per week */}
                {weeklyVolume.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Neue vs. geschlossene Issues pro Woche</h3>
                        <p className="text-xs text-gray-400 mb-3">Nicht kumulativ — zeigt Aktivität pro Kalenderwoche</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={weeklyVolume}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip
                                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                                    formatter={(v: number, name: string) => [v, name === 'opened' ? 'Geöffnet' : 'Geschlossen']}
                                />
                                <Legend formatter={n => n === 'opened' ? 'Geöffnet' : 'Geschlossen'} />
                                <Bar dataKey="opened" fill="#ef4444" name="opened" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="closed" fill="#22c55e" name="closed" radius={[3, 3, 0, 0]} />
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

                {/* 4 — Burndown cumulative */}
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

                {/* 5 — Cycle time per category */}
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

                {/* 6 — Estimate accuracy scatter */}
                {scatter.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Schätzgenauigkeit — Geschätzt vs. Tatsächlich</h3>
                        <p className="text-xs text-gray-400 mb-3">Punkte auf der Linie = perfekte Schätzung · darüber = Überschreitung · darunter = Unterschreitung</p>
                        <ResponsiveContainer width="100%" height={280}>
                            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" dataKey="estimated" name="Geschätzt" unit="h" domain={[0, maxScatter * 1.1]} tick={{ fontSize: 11 }} />
                                <YAxis type="number" dataKey="actual" name="Tatsächlich" unit="h" domain={[0, maxScatter * 1.1]} tick={{ fontSize: 11 }} />
                                <ZAxis range={[40, 40]} />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                                    content={({ payload }) => {
                                        if (!payload?.length) return null;
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
                                                <p className="font-semibold text-gray-800 mb-1">#{d.iid} {d.title}</p>
                                                <p>Geschätzt: {d.estimated}h</p>
                                                <p>Tatsächlich: {d.actual}h</p>
                                            </div>
                                        );
                                    }}
                                />
                                <ReferenceLine
                                    segment={[{ x: 0, y: 0 }, { x: maxScatter, y: maxScatter }]}
                                    stroke="#94a3b8" strokeDasharray="4 4"
                                    label={{ value: 'Perfekt', position: 'insideTopLeft', fontSize: 11, fill: '#94a3b8' }}
                                />
                                <Scatter data={scatter} fill="#3b82f6" fillOpacity={0.7} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* 7 — Open issues by age */}
                {aging.some(b => b.count > 0) && (
                    <section>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">Offene Issues nach Alter</h3>
                        <p className="text-xs text-gray-400 mb-3">Wie lange sind offene Issues bereits offen?</p>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={aging}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip
                                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                                    formatter={(v: number) => [v, 'Issues']}
                                />
                                <Bar dataKey="count" name="Issues" radius={[4, 4, 0, 0]}>
                                    {aging.map((_, i) => (
                                        <Cell key={i} fill={['#22c55e', '#86efac', '#fde047', '#f59e0b', '#fb923c', '#ef4444', '#b91c1c'][i]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

            </div>
        </div>
    );
}
