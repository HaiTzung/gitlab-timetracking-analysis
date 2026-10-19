## Time Tracking Dashboard

A dashboard built for software engineering projects at DHBW.
It provides analysis for issue-based time tracking, which GitLab itself does not natively offer.

> [!NOTE]
> This project was developed in a short amount of time, so the code quality is not great.
> It's more a "it just works somehow" kind of project.

## Features

- 📊 **Project Overview**: Sprint metrics, velocity tracking, and category distribution
- 📈 **Time Series Charts**: Weekly performance trends and team activity comparison
- 🎯 **Team & Categories**: Pie charts and bar charts for time allocation analysis
- ⚡ **Productivity Analysis**: Hourly and weekly productivity patterns
- 👥 **Team Collaboration**: Network visualization of team collaboration
- 📋 **Issue Analysis**: Issue complexity and time analysis
- 📅 **Detailed Activity**: GitHub-style activity heatmap
- 🔒 **Password protection**: Shared password login with persistent cookie
- ⬇ **CSV Export**: Export last 7 days of timelogs
- ⏱ **Auto-Refresh**: Configurable polling interval

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

The dashboard is available at `http://localhost:3010` (or whichever port you set).

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
| `GITLAB_TOKEN` | ✅ | Personal access token with `read_api` scope |
| `ACCESS_PASSWORD` | ✅ | Shared password for the login screen |
| `NEXT_PUBLIC_GITLAB_GROUP_PATH` | ✅ | Full GitLab group path, e.g. `mygroup/myproject` |
| `NEXT_PUBLIC_GITLAB_ISSUE_BASE_URL` | ✅ | Base URL for issue links, e.g. `https://gitlab.com/mygroup/myproject/-/issues` |
| `NEXT_PUBLIC_PROJECT_NAME` | ✅ | Display name shown in the navbar, e.g. `G3-UniGames` |
| `NEXT_PUBLIC_START_DATE` | ✅ | Project start date in `YYYY-MM-DD` format |
| `NEXT_PUBLIC_END_DATE` | ✅ | Project end date in `YYYY-MM-DD` format |
| `GITLAB_API_URL` | ❌ | Only needed for self-hosted GitLab instances |
| `CLOUDFLARE_TUNNEL_TOKEN` | ❌ | Only needed if using Cloudflare Tunnel for public access |

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
