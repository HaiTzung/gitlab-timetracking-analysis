import { getCached } from '@/lib/cache';
import { TEAM_MEMBERS, GITLAB_CONFIG } from '@/config/dashboardConfig';
import type { Issue, Epic, Milestone, Timelog } from '@/types/dashboard';

export interface CachedDashboardData {
  issues: Issue[];
  epics: Epic[];
  milestones: Milestone[];
  timelogs: Timelog[];
  fetchedAt: number | null;
}

export function readCachedDashboardData(startDate: Date, endDate: Date): CachedDashboardData | null {
  const issueEntry = getCached(`issues:${GITLAB_CONFIG.GROUP_PATH}`);
  const epicEntry  = getCached(`epics:${GITLAB_CONFIG.GROUP_PATH}`);
  const msEntry    = getCached(`milestones:${GITLAB_CONFIG.GROUP_PATH}`);

  // Need at least issues to be worth showing pre-populated data
  if (!issueEntry) return null;

  const issues: Issue[]     = (issueEntry.data as any)?.data?.group?.issues?.nodes     ?? [];
  const epics: Epic[]       = epicEntry  ? ((epicEntry.data  as any)?.data?.group?.epics?.nodes     ?? []) : [];
  const milestones: Milestone[] = msEntry ? ((msEntry.data   as any)?.data?.group?.milestones?.nodes ?? []) : [];

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr   = endDate.toISOString().slice(0, 10);

  const timelogs: Timelog[] = [];
  for (const username of TEAM_MEMBERS) {
    const tlEntry = getCached(`timelogs:${username}:${startStr}:${endStr}`);
    if (tlEntry) {
      const nodes: Timelog[] = (tlEntry.data as any)?.data?.group?.timelogs?.nodes ?? [];
      timelogs.push(...nodes);
    }
  }

  const fetchedAt = issueEntry.fetchedAt;

  return { issues, epics, milestones, timelogs, fetchedAt };
}
