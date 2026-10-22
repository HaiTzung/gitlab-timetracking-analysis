'use client';

import { useTheme } from 'next-themes';

export function useChartColors() {
    const { resolvedTheme } = useTheme();
    const dark = resolvedTheme === 'dark';
    return {
        grid:          dark ? '#374151' : '#e5e7eb',
        axis:          dark ? '#9ca3af' : '#6b7280',
        tooltipBg:     dark ? '#1f2937' : '#ffffff',
        tooltipBorder: dark ? '#374151' : '#e5e7eb',
        tooltipLabel:  dark ? '#f3f4f6' : '#111827',
    };
}
