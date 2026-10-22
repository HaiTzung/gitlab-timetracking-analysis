"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
  const navRef = useRef<HTMLElement>(null);
  const ctx = useDashboardContext();
  const activeWindow = ctx?.timeWindow ?? "all";

  // Build list of calendar weeks from earliest timelog to today
  const kwOptions = useMemo(() => {
    const logs = ctx?.timelogs ?? [];
    if (!logs.length) return [];
    const earliest = logs.reduce(
      (min, t) => (t.spentAt < min ? t.spentAt : min),
      logs[0].spentAt,
    );
    const start = startOfWeek(parseISO(earliest), { weekStartsOn: 1 });
    const end = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    const todayStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);
    return weeks
      .map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const isCurrent = weekStart.toISOString().slice(0, 10) === todayStart;
        const base = `KW ${format(weekStart, "II/yy", { locale: de })} (${format(weekStart, "dd.MM", { locale: de })}–${format(weekEnd, "dd.MM", { locale: de })})`;
        return { label: isCurrent ? `${base} · diese Woche` : base, weekStart, weekEnd, isCurrent };
      })
      .reverse(); // newest first
  }, [ctx?.timelogs]);

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
      className={`flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${
        open ? "w-56" : "w-0"
      }`}
    >
      <div className="w-56 flex flex-col h-full py-4">
        {/* Nav links */}
        <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Navigation
        </p>
        <nav ref={navRef} className="flex flex-col gap-0.5 px-2 overflow-y-auto flex-1">
          {NAV_ITEMS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                activeId === id
                  ? "bg-gray-200 text-gray-900 font-semibold"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  activeId === id ? "bg-gray-700" : "bg-gray-300"
                }`}
              />
              <span className="whitespace-nowrap">{label}</span>
            </a>
          ))}
        </nav>

        {/* Time window — pinned to bottom */}
        <div className="px-3 pt-3 border-t border-gray-200 mt-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Zeitfenster
          </p>

          {/* Mode toggle */}
          <div className="flex rounded-md overflow-hidden border border-gray-200 mb-3">
            <button
              onClick={() => switchMode("kw")}
              className={`flex-1 py-1 text-xs font-medium transition-colors ${
                mode === "kw"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              KW
            </button>
            <button
              onClick={() => switchMode("custom")}
              className={`flex-1 py-1 text-xs font-medium transition-colors border-l border-gray-200 ${
                mode === "custom"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Benutzerdefiniert
            </button>
          </div>

          {/* KW picker */}
          {mode === "kw" && (
            <select
              value={selectedKwIndex}
              onChange={handleKwChange}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Wochen</option>
              {kwOptions.map((opt, idx) => (
                <option key={idx} value={idx}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Custom date range picker */}
          {mode === "custom" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-500">Von</label>
              <input
                type="date"
                value={draftStart}
                max={todayStr()}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="text-xs text-gray-500">Bis</label>
              <input
                type="date"
                value={draftEnd}
                min={draftStart || undefined}
                max={todayStr()}
                onChange={(e) => handleEndChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
