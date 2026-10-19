"use client";

import { useState } from "react";
import TitleBar from "./TitleBar";
import Sidebar from "./Sidebar";
import { DashboardProvider } from "@/context/DashboardContext";

const GROUP_PATH = process.env.NEXT_PUBLIC_GITLAB_GROUP_PATH ?? "";
// const PROJECT_NAME = GROUP_PATH.split('/').pop() ?? 'Dashboard';
const PROJECT_NAME = "G3-UniGames";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <DashboardProvider>
      <div className="flex flex-col h-screen bg-gray-50">
        <TitleBar onMenuToggle={() => setSidebarOpen((prev) => !prev)} projectName={PROJECT_NAME} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar open={sidebarOpen} />
          <main className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}
