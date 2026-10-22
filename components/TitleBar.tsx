'use client';

import { useDashboardContext } from '@/context/DashboardContext';

interface TitleBarProps {
    onMenuToggle: () => void;
    projectName: string;
}

export default function TitleBar({ onMenuToggle, projectName }: TitleBarProps) {
    const ctx = useDashboardContext();

    return (
        <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm z-20">
            <div className="h-14 flex items-center px-4 gap-4">
                <button
                    onClick={onMenuToggle}
                    className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                    aria-label="Toggle navigation"
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <rect x="2" y="4" width="16" height="2" rx="1" />
                        <rect x="2" y="9" width="16" height="2" rx="1" />
                        <rect x="2" y="14" width="16" height="2" rx="1" />
                    </svg>
                </button>

                <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
                    {projectName}
                </h1>

                <span className="text-gray-300 dark:text-gray-600 text-lg font-light">×</span>

                {/* Client logo */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="https://www.uniliga.gg/wp-content/uploads/2026/08/uniliga_wordmarkicon_blue.svg"
                    alt="Uniliga"
                    className="h-6 w-auto dark:invert"
                />

                <div className="flex-1" />

                {ctx && (
                    <button
                        onClick={ctx.onPresentationMode}
                        disabled={ctx.timelogs.length === 0}
                        className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Präsentationsmodus"
                        aria-label="Präsentationsmodus"
                    >
                        {/* Monitor / presentation icon */}
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="16" height="11" rx="1.5" />
                            <path d="M7 17h6M10 14v3" />
                        </svg>
                    </button>
                )}
            </div>
        </header>
    );
}
