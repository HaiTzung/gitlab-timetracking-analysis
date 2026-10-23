"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { useDashboardContext } from "@/context/DashboardContext";
import {
  eachWeekOfInterval,
  startOfWeek,
  endOfWeek,
  parseISO,
  format,
  addDays,
} from "date-fns";
import { de } from "date-fns/locale";

const NAV_ITEMS = [
  { id: "projektubersicht",       label: "Projektübersicht" },
  { id: "detaillierte-aktivitat", label: "Aktivität" },
  { id: "issue-zeitanalyse",      label: "Issues" },
  { id: "issue-analyse",          label: "Issue Analyse" },
  { id: "zeitliche-entwicklung",  label: "Zeitliche Entwicklung" },
  { id: "team-kategorien",        label: "Team & Kategorien" },
  { id: "leaderboard",            label: "Leaderboard" },
  { id: "produktivitatsanalyse",  label: "Produktivitätsanalyse" },
  { id: "team-zusammenarbeit",    label: "Team Zusammenarbeit" },
];

function toInputDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SidebarProps {
  open: boolean;
}

export default function Sidebar({ open }: SidebarProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [mode, setMode] = useState<"kw" | "custom">("kw");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [tuOffset, setTuOffset] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const ctx = useDashboardContext();
  const activeWindow = ctx?.timeWindow ?? "all";
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const themeTitle = theme === "light" ? "Hell → Dunkel" : theme === "dark" ? "Dunkel → Auto" : "Auto → Hell";

  // Build list of calendar weeks from earliest timelog to today
  const kwOptions = useMemo(() => {
    const logs = ctx?.timelogs ?? [];
    if (!logs.length) return [];
    const earliest = logs.reduce(
      (min, t) => (t.spentAt < min ? t.spentAt : min),
      logs[0].spentAt,
    );
    const monStart = startOfWeek(parseISO(earliest), { weekStartsOn: 1 });
    const monEnd   = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weeks = eachWeekOfInterval({ start: monStart, end: monEnd }, { weekStartsOn: 1 });
    const todayMonAnchor = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);
    return weeks
      .map((mon) => {
        const wStart = tuOffset ? addDays(mon, 1) : mon;
        const wEnd   = tuOffset
          ? new Date(new Date(addDays(mon, 7)).setHours(23, 59, 59, 0))
          : endOfWeek(mon, { weekStartsOn: 1 });
        const isCurrent = mon.toISOString().slice(0, 10) === todayMonAnchor;
        const base = `KW ${format(mon, "II/yy", { locale: de })} (${format(wStart, "dd.MM", { locale: de })}–${format(wEnd, "dd.MM", { locale: de })})`;
        return { label: isCurrent ? `${base} · diese Woche` : base, weekStart: wStart, weekEnd: wEnd, isCurrent };
      })
      .reverse();
  }, [ctx?.timelogs, tuOffset]);

  // Detect active scroll section
  useEffect(() => {
    const scroller = document.getElementById("main-scroll");
    if (!scroller) return;
    const getActive = () => {
      const midpoint =
        scroller.getBoundingClientRect().top + scroller.clientHeight * 0.35;
      let best: string = NAV_ITEMS[0].id;
      for (const { id } of NAV_ITEMS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= midpoint) best = id;
      }
      setActiveId(best);
    };
    getActive();
    scroller.addEventListener("scroll", getActive, { passive: true });
    return () => scroller.removeEventListener("scroll", getActive);
  }, []);

  // Scroll sidebar nav to keep active link visible
  useEffect(() => {
    if (!activeId || !navRef.current) return;
    const nav = navRef.current;
    const link = nav.querySelector<HTMLElement>(`a[href="#${activeId}"]`);
    if (!link) return;
    const navTop = nav.scrollTop;
    const navBottom = navTop + nav.clientHeight;
    const linkTop = link.offsetTop;
    const linkBottom = linkTop + link.offsetHeight;
    if (linkTop < navTop) {
      nav.scrollTo({ top: linkTop - 8, behavior: "smooth" });
    } else if (linkBottom > navBottom) {
      nav.scrollTo({ top: linkBottom - nav.clientHeight + 8, behavior: "smooth" });
    }
  }, [activeId]);

  const handleCsvExport = () => {
    if (!ctx) return;
    const { timeWindow, customStart, customEnd } = ctx;
    const now = new Date();
    let from: Date | null = null;
    let to: Date = now;
    if (timeWindow === '7d')        from = new Date(now.getTime() - 7 * 86400000);
    else if (timeWindow === '14d')  from = new Date(now.getTime() - 14 * 86400000);
    else if (timeWindow === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (timeWindow === 'custom' || timeWindow === 'kw') { from = customStart; if (customEnd) to = customEnd; }
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

  const switchMode = (m: "kw" | "custom") => {
    setMode(m);
    if (m === "kw") {
      // Reset to "all" when switching back to KW mode without a selection
      if (activeWindow === "custom") ctx?.onSetTimeWindow("all");
    } else {
      setDraftStart(toInputDate(ctx?.customStart ?? null));
      setDraftEnd(toInputDate(ctx?.customEnd ?? null));
    }
  };

  const handleKwChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "") {
      ctx?.onSetTimeWindow("all");
      ctx?.onSetCustomDates(null, null);
      return;
    }
    const idx = Number(val);
    const { weekStart, weekEnd } = kwOptions[idx];
    ctx?.onSetTimeWindow("kw");
    ctx?.onSetCustomDates(weekStart, new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59));
  };

  const handleCustomApply = () => {
    const start = draftStart ? new Date(draftStart) : null;
    const end = draftEnd ? new Date(draftEnd + "T23:59:59") : null;
    ctx?.onSetCustomDates(start, end);
    ctx?.onSetTimeWindow("custom");
  };

  const handleStartChange = (val: string) => {
    setDraftStart(val);
    if (draftEnd && val > draftEnd) setDraftEnd(val);
  };

  const handleEndChange = (val: string) => {
    if (val < draftStart) setDraftEnd(draftStart);
    else setDraftEnd(val);
  };

  // Determine which KW index is currently selected (for controlled select)
  const selectedKwIndex = useMemo(() => {
    if (activeWindow !== "kw" || !ctx?.customStart) return "";
    const startStr = ctx.customStart.toISOString().slice(0, 10);
    const idx = kwOptions.findIndex(
      (opt) => opt.weekStart.toISOString().slice(0, 10) === startStr,
    );
    return idx >= 0 ? String(idx) : "";
  }, [activeWindow, ctx?.customStart, kwOptions]);

  return (
    <aside
      className={`flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300 ${
        open ? "w-56" : "w-0"
      }`}
    >
      <div className="w-56 flex flex-col h-full py-4">
        {/* Nav links */}
        <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Navigation
        </p>
        <nav ref={navRef} className="flex flex-col gap-0.5 px-2 overflow-y-auto flex-1">
          {NAV_ITEMS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                activeId === id
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  activeId === id ? "bg-gray-700 dark:bg-gray-300" : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
              <span className="whitespace-nowrap">{label}</span>
            </a>
          ))}
        </nav>

        {/* Time window + actions — pinned to bottom */}
        <div className="px-3 pt-4 pb-2 border-t border-gray-200 dark:border-gray-700 mt-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
            Zeitfenster
          </p>

          {/* Mode toggle */}
          <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 mb-3">
            <button
              onClick={() => switchMode("kw")}
              className={`flex-1 py-1 text-xs font-medium transition-colors ${
                mode === "kw"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              KW
            </button>
            <button
              onClick={() => switchMode("custom")}
              className={`flex-1 py-1 text-xs font-medium transition-colors border-l border-gray-200 dark:border-gray-600 ${
                mode === "custom"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Benutzerdefiniert
            </button>
          </div>

          {/* KW picker */}
          {mode === "kw" && (
            <>
            <div className="relative">
            <select
              value={selectedKwIndex}
              onChange={handleKwChange}
              className="w-full appearance-none border border-gray-300 dark:border-gray-600 rounded-md pl-2 pr-7 py-1.5 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Wochen</option>
              {kwOptions.map((opt, idx) => (
                <option key={idx} value={idx}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4l4 4 4-4" />
            </svg>
            </div>

            {/* Week offset toggle */}
            <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 mt-2">
              <button
                onClick={() => { setTuOffset(true); ctx?.onSetTimeWindow("all"); ctx?.onSetCustomDates(null, null); }}
                className={`flex-1 py-1 text-xs font-medium transition-colors ${tuOffset ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
              >Di–Mo</button>
              <button
                onClick={() => { setTuOffset(false); ctx?.onSetTimeWindow("all"); ctx?.onSetCustomDates(null, null); }}
                className={`flex-1 py-1 text-xs font-medium transition-colors border-l border-gray-200 dark:border-gray-600 ${!tuOffset ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
              >Mo–So</button>
            </div>
            </>
          )}

          {/* Custom date range picker */}
          {mode === "custom" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">Von</label>
              <input
                type="date"
                value={draftStart}
                max={todayStr()}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-xs text-gray-500 dark:text-gray-400">Bis</label>
              <input
                type="date"
                value={draftEnd}
                min={draftStart || undefined}
                max={todayStr()}
                onChange={(e) => handleEndChange(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-1.5 mt-0.5">
                <button
                  onClick={handleCustomApply}
                  className="flex-1 bg-blue-600 text-white rounded-md px-2 py-1 text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  Übernehmen
                </button>
                <button
                  onClick={() => {
                    setDraftStart("");
                    setDraftEnd("");
                    ctx?.onSetCustomDates(null, null);
                    ctx?.onSetTimeWindow("all");
                  }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions + dark mode toggle */}
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
          {/* CSV Export */}
          <button
            onClick={handleCsvExport}
            disabled={!ctx || ctx.timelogs.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="CSV exportieren"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M5 7l3 3 3-3" />
              <path d="M3 13h10" />
            </svg>
            CSV
          </button>

          {/* Refresh */}
          <button
            onClick={ctx?.onRefresh}
            disabled={!ctx}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Daten neu laden"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2" />
              <path d="M13.5 2v3h-3" />
            </svg>
            Laden
          </button>

          {/* Theme cycle: light → dark → auto */}
          <button
            onClick={cycleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            title={themeTitle}
            aria-label="Toggle theme"
            suppressHydrationWarning
          >
            {/* Sun: light mode active */}
            {theme === "light" && (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
              </svg>
            )}
            {/* Moon: dark mode active */}
            {theme === "dark" && (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z" />
              </svg>
            )}
            {/* Half-sun/half-moon: system/auto */}
            {(theme === "system" || !theme) && (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="5" />
                <path d="M8 3v10" />
                <path fill="currentColor" stroke="none" d="M8 3a5 5 0 0 1 0 10V3z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
