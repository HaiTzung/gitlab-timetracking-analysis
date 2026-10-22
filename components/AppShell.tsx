"use client";

import { useEffect, useState } from "react";
import TitleBar from "./TitleBar";
import Sidebar from "./Sidebar";
import { DashboardProvider } from "@/context/DashboardContext";

const GROUP_PATH = process.env.NEXT_PUBLIC_GITLAB_GROUP_PATH ?? "";
const PROJECT_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? GROUP_PATH.split('/').pop() ?? 'Dashboard';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // The scroll container is <main>, not window/body. The browser's native anchor
  // handling targets body scroll, so #hash links on load land at the top.
  // This effect manually scrolls the right container once the page has rendered.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    // Wait for content to render before scrolling
    const id = setTimeout(() => {
      const target = document.getElementById(hash);
      const scroller = document.getElementById('main-scroll');
      if (!target || !scroller) return;
      const scrollerTop = scroller.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      scroller.scrollTop += targetTop - scrollerTop - 16;
    }, 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <DashboardProvider>
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
        <TitleBar onMenuToggle={() => setSidebarOpen((prev) => !prev)} projectName={PROJECT_NAME} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar open={sidebarOpen} />
          <main id="main-scroll" className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}
