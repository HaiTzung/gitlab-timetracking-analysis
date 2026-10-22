## Time Tracking Dashboard

A dashboard built for software engineering projects at DHBW.
It provides analysis for issue-based time tracking, which GitLab itself does not natively offer.

> [!NOTE]
> This project was developed in a short amount of time, so the code quality is not great.
> It's more a "it just works somehow" kind of project.

## Features

### Time Window Controls

The sidebar lets you filter all charts to a specific time window:

- **KW (Calendar Week)** — pick any past or current calendar week since project start; all charts that support it switch to a daily breakdown for the selected week
- **Benutzerdefiniert (Custom)** — free-form start/end date range
- **Alle Wochen** — unfiltered, shows the full project history

When a specific KW is selected, several charts adapt automatically:
- *Stunden pro Woche pro Person* → daily hours per person for that week
- *Kategorie-Trend* → daily stacked area for that week
- *Wöchentliche Leistung* → daily bar chart for that week
- *Kumulativer Fortschritt* → daily cumulative for that week
- *Issues pro Kategorie* → 4-bar comparison: current week vs. previous week
- *Zeitaufwand-Tabelle* → syncs its week picker to the selected KW

### Dashboard Sections

**Projektübersicht**
- KPI tiles: weekly performance, main focus category, average issue cycle time, most active week
- Activity heatmap (GitHub-style contribution grid)

**Aktivität**
- *Zeitaufwand pro Person & Kategorie* — hours per person per category with a week picker; navigation clamped to project start; Markdown export/copy
- *Kategorie-Trend* — AreaChart of hours per category; daily breakdown in KW mode
- *Aktivitätsverlauf* — collapsible feed of time logs, issue opens/closes, and comments

**Kategorie-Analyse**
- *Burndown — kumulativer Verlauf* — cumulative opened vs. closed issues
- *Gebuchte Stunden pro Kategorie (wöchentlich)* — weekly hours per category
- *Issues pro Kategorie — Offen vs. Geschlossen* — 2-bar chart in all-time mode; 4-bar (prev/current week) in KW mode with color-coded comparison
- *Ø Bearbeitungszeit pro Kategorie* — average cycle time per category

**Issues**
- *Neue vs. geschlossene Issues pro Woche* — opened vs. closed per week
- *Issue-Baum* — epic/issue tree, filterable by state

**Issue Analyse**
- *Geschätzt vs. Gebucht pro Kategorie* — estimated vs. actual hours per category
- *Issue Komplexität* — average hours per issue by category
- *Offene Issues nach Alter* — open issues bucketed by age
- *Schätzgenauigkeit — Geschätzt vs. Tatsächlich* — scatter chart comparing estimate vs. actual for **closed** issues with both values set

**Zeitliche Entwicklung**
- *Kumulativer Fortschritt* — cumulative hours over time; daily in KW mode
- *Team Aktivitätsvergleich* — hours per person per sprint, stacked/grouped
- *Wöchentliche Leistung* — total hours per sprint/week; daily bar in KW mode
- *Stunden pro Woche pro Person* — weekly line chart; daily breakdown in KW mode

**Team & Kategorien**
- *Kategorie Verteilung* — pie chart of hours per category
- *Teammitglieder pro Kategorie* — radar charts, one per category with members as axes
- *Kategorienverteilung pro Teammitglied* — radar charts, one per member with categories as axes
- *Team Aktivität* — total hours per team member
- *Letzte Buchung pro Teammitglied* — booking counts; in all-time mode shows total count + last booking date; in KW mode shows count within the selected window only

**Leaderboard** — hours, issues worked/created/closed with % of total, sortable

**Produktivitätsanalyse** — hourly and weekday distribution charts

**Team Zusammenarbeit** — top pairs by shared issues; average team size per category

### Other

- 🔒 **Password protection** — shared password login with persistent cookie
- ⬇ **CSV Export** — export last 7 days of timelogs
- ⏱ **Auto-Refresh** — configurable polling interval
- 📊 **Presentation Mode** — full-screen layout without sidebar

---

## Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd gitlab-timetracking-analysis
cp .env.example .env
```

Edit `.env` and fill in all values (see section below).

### 2. Configure team members and categories

Open `config/dashboardConfig.ts` and update:

```typescript
export const TEAM_MEMBERS = [
    "username1",
    "username2",
    // GitLab usernames of all team members
] as const;

export const CATEGORIES = {
    REQUIREMENTS_ENGINEERING: "category::requirements",
    ENTWURF:                  "category::architecture",
    IMPLEMENTATION_TEST:      "category::implementation",
    PROJEKTMANAGEMENT:        "category::project-management",
} as const;
```

> [!WARNING]
> The category values must exactly match the GitLab labels on your issues.
> You can find your labels at `https://gitlab.com/<group>/-/labels`.

### 3. Run with Docker

```bash
docker compose up --build
```

The dashboard is available at `http://localhost:3010` (or whichever port you set in `.env`).

On subsequent starts without config changes:

```bash
docker compose up -d
```

To rebuild after changing any `.env` value:

```bash
docker compose up --build
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `GITLAB_TOKEN` | ✅ | Personal access token with `read_api` scope — **server-side only, never prefix with `NEXT_PUBLIC_`** |
| `ACCESS_PASSWORD` | ✅ | Shared password for the login screen — **runtime env only, never a build arg** |
| `NEXT_PUBLIC_GITLAB_GROUP_PATH` | ✅ | Full GitLab group path, e.g. `mygroup/myproject` |
| `NEXT_PUBLIC_GITLAB_ISSUE_BASE_URL` | ✅ | Base URL for issue links, e.g. `https://gitlab.com/mygroup/myproject/-/issues` |
| `NEXT_PUBLIC_PROJECT_NAME` | ✅ | Display name shown in the navbar, e.g. `G3-UniGames` |
| `NEXT_PUBLIC_START_DATE` | ✅ | Project start date in `YYYY-MM-DD` format — used to clamp KW navigation and chart ranges |
| `NEXT_PUBLIC_END_DATE` | ✅ | Project end date in `YYYY-MM-DD` format |
| `GITLAB_API_URL` | ❌ | Only needed for self-hosted GitLab instances |
| `CLOUDFLARE_TUNNEL_TOKEN` | ❌ | Only needed if using Cloudflare Tunnel for public access |

> [!IMPORTANT]
> `GITLAB_TOKEN` is read exclusively in server-side API routes. Never expose it as `NEXT_PUBLIC_GITLAB_TOKEN` — that would embed it in the client bundle.
>
> `ACCESS_PASSWORD` must be set at container runtime, not as a Docker build argument, so it never ends up in the image layer.

### Getting a GitLab token

1. GitLab → **User Settings** → **Access Tokens**
2. Create a token with **`read_api`** scope
3. Paste it as `GITLAB_TOKEN` in `.env`

---

## Public access via Cloudflare Tunnel (optional)

If you want to expose the dashboard publicly without opening a port, add a `cloudflared` service to your stack. The `docker-compose.yml` already includes it — just set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`.

In the Cloudflare Zero Trust dashboard, add a public hostname pointing to `http://app:3000` (the internal Docker service name, not `localhost`).

---

## Health check

`GET /api/health` returns `{"status":"ok","timestamp":"..."}` — no authentication required. Wire it into Uptime Kuma or any other monitor.

---

## Contributing

If you want to improve this project, feel free to create a fork :)

## Support

If you need help setting up the project, feel free to contact on Discord:
[cubepixels](https://discord.com/users/cubepixels)
