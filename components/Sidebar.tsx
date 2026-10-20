"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboardContext, TimeWindow } from "@/context/DashboardContext";

const NAV_ITEMS = [
  { id: "projektubersicht", label: "Projektübersicht" },
  { id: "detaillierte-aktivitat", label: "Aktivität" },
  { id: "issue-zeitanalyse", label: "Issues" },
  { id: "issue-analyse", label: "Issue Analyse" },
  { id: "zeitliche-entwicklung", label: "Zeitliche Entwicklung" },
  { id: "team-kategorien", label: "Team & Kategorien" },
  { id: "produktivitatsanalyse", label: "Produktivitätsanalyse" },
  { id: "team-zusammenarbeit", label: "Team Zusammenarbeit" },
  { id: "kategorie-analyse", label: "Kategorie-Analyse" },
  { id: "leaderboard", label: "Leaderboard" },
];

const PRESETS: { label: string; value: TimeWindow }[] = [
  { label: "Alle", value: "all" },
  { label: "7 Tage", value: "7d" },
  { label: "14 Tage", value: "14d" },
  { label: "Monat", value: "month" },
];

function toInputDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

interface SidebarProps {
  open: boolean;
}

export default function Sidebar({ open }: SidebarProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const ctx = useDashboardContext();
  const activeWindow = ctx?.timeWindow ?? "all";

  // Determine active section by finding the topmost section whose top edge
  // is at or above 35% down the viewport. Listens on the main scroll container,
  // not window (the page uses overflow-y-auto on <main>, not body scroll).
  useEffect(() => {
    const scroller = document.getElementById('main-scroll');
    if (!scroller) return;

    const getActive = () => {
      const midpoint = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.35;
      let best: string = NAV_ITEMS[0].id;
      for (const { id } of NAV_ITEMS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= midpoint) best = id;
      }
      setActiveId(best);
    };

    getActive();
    scroller.addEventListener('scroll', getActive, { passive: true });
    return () => scroller.removeEventListener('scroll', getActive);
  }, []);

  // Scroll the sidebar nav to keep the active link visible inside the nav container.
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
      nav.scrollTo({ top: linkTop - 8, behavior: 'smooth' });
    } else if (linkBottom > navBottom) {
      nav.scrollTo({ top: linkBottom - nav.clientHeight + 8, behavior: 'smooth' });
    }
  }, [activeId]);

  const handlePreset = (w: TimeWindow) => {
    ctx?.onSetTimeWindow(w);
    if (w !== "custom") setCustomOpen(false);
  };

  const handleCustomOpen = () => {
    setDraftStart(toInputDate(ctx?.customStart ?? null));
    setDraftEnd(toInputDate(ctx?.customEnd ?? null));
    setCustomOpen(true);
    ctx?.onSetTimeWindow("custom");
  };

  const handleCustomApply = () => {
    const start = draftStart ? new Date(draftStart) : null;
    const end = draftEnd ? new Date(draftEnd + "T23:59:59") : null;
    ctx?.onSetCustomDates(start, end);
    setCustomOpen(false);
  };

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
          <div className="flex flex-col gap-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={`w-full flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors text-left ${
                  activeWindow === p.value
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    activeWindow === p.value ? "bg-blue-600" : "bg-gray-300"
                  }`}
                />
                {p.label}
              </button>
            ))}
            <button
              onClick={handleCustomOpen}
              className={`w-full flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors text-left ${
                activeWindow === "custom"
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  activeWindow === "custom" ? "bg-blue-600" : "bg-gray-300"
                }`}
              />
              Benutzerdefiniert
            </button>
          </div>

          {customOpen && (
            <div className="mt-2 flex flex-col gap-1.5">
              <input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
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
                  onClick={() => {
                    setCustomOpen(false);
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
