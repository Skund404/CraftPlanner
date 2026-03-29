# CraftPlanner

Project management for makers. Track materials, tools, techniques, and progress across any creative craft — cosplay, leatherwork, woodwork, sewing, and more.

## Features

- **Project management** — Create projects with budgets, deadlines, and items to make or buy
- **Item tracking** — Expandable item rows with make/buy/task types, cost estimates, time logging, supplier links
- **Budget tracking** — Cost entries by category (materials, tools, services, shipping, other) with stacked breakdown charts
- **Time logging** — Per-item time tracking with daily timeline view and per-item breakdown bars
- **Suppliers** — First-class supplier management with ratings, contact info, linked to items and costs
- **Photo gallery** — Upload project photos, browse in a grid, view in a lightbox
- **Structured notes** — Four collapsible sections (Client, Construction, Lessons Learned, General) with auto-save
- **Events** — Track conventions, meetups, and occasions where projects are shown
- **Shopping list** — Aggregated buy-items across projects, grouped by project or by supplier
- **Catalogue** — Git-backed library of materials, tools, techniques, and workflows (via Core)
- **Quick log** — Sidebar timer widget with item selector for fast time tracking
- **Dashboard** — Stats, active projects with progress bars, activity feed grouped by day, upcoming timeline, budget health

## Architecture

```
CraftPlanner/
├── core/           # Go — Git-backed catalogue engine (port 8420)
├── shell/          # Python/FastAPI — API + React UI (port 8400)
│   ├── backend/    # FastAPI endpoints, SQLite UserDB
│   ├── frontend/   # React + Tailwind v4 + Radix UI
│   └── module/     # CraftPlanner module (views, components, routes)
└── electron/       # Desktop wrapper (Windows + Linux)
```

- **Core** (Go) — Manages primitives (materials, tools, techniques, workflows) as JSON manifest files in a Git repository. SQLite read index for fast queries. REST API for CRUD, search, and relationships.
- **Shell** (Python/FastAPI + React/TypeScript) — UI layer and user data. SQLite UserDB stores projects, items, time logs, costs, suppliers, photos, and events. Single always-active module with 8 registered views.
- **Electron** — Desktop wrapper packaging Core + Shell for Windows (NSIS) and Linux (AppImage + deb).

## Tech Stack

| Layer     | Technology                                           |
|-----------|------------------------------------------------------|
| Core      | Go 1.24+, SQLite, Git                                |
| Backend   | Python 3.10+, FastAPI, aiosqlite, Pydantic 2.x      |
| Frontend  | React 19, TypeScript, Tailwind v4, Radix UI          |
| Data      | TanStack React Query, TanStack Router                |
| Desktop   | Electron                                             |

## Quick Start

### Prerequisites

- Go 1.24+ (for Core)
- Python 3.10+ (for Shell backend)
- Node.js 20+ (for frontend)

### Development

```bash
# 1. Start the Core catalogue engine
cd core && go build ./cmd/craftplanner-core/ && ./craftplanner-core

# 2. Start the Shell backend (in another terminal)
cd shell && pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --port 8400

# 3. Start the frontend dev server (in another terminal)
cd shell/frontend && npm install && npm run dev
```

### Electron (Desktop)

```bash
cd electron && npm install && npm start
```

### Build

```bash
# Frontend production build
cd shell/frontend && npm run build

# Run tests
cd core && go test ./...
cd shell && python3 -m pytest backend/tests/ -q
```

## Project Structure

### Views

| Route              | View               | Description                          |
|--------------------|--------------------|--------------------------------------|
| `/dashboard`       | DashboardView      | Stats, activity feed, budget health  |
| `/projects`        | ProjectsView       | Project list with search + filters   |
| `/projects/:id`    | ProjectDetailView  | 8-tab project workspace              |
| `/suppliers`       | SuppliersView      | Supplier directory with CRUD         |
| `/shopping-list`   | ShoppingListView   | Buy items grouped by project/supplier|
| `/catalogue`       | CatalogueView      | Core primitive browser               |
| `/events`          | EventsView         | Event list with upcoming/past        |
| `/settings`        | SettingsView       | Workshop preferences                 |

### Project Detail Tabs

The project detail view is decomposed into 15 focused files:

| Tab        | Description                                              |
|------------|----------------------------------------------------------|
| Items      | Make/buy items with expandable rows, filters, supplier links |
| Tasks      | Simple task checklist with progress bar                  |
| Budget     | Cost summary cards, category breakdown bar, cost entries |
| Time Log   | Time stats, per-item horizontal bars, daily timeline     |
| Events     | Linked events with star ratings                          |
| Suppliers  | Project supplier cards with contact/rating/spend data    |
| Gallery    | Photo grid with upload and lightbox viewer               |
| Notes      | 4 structured sections with collapsible headers + auto-save |

### Data Model

```
craftplanner_projects         — Projects with budget, deadline, status lifecycle
craftplanner_items            — Make/buy/task items linked to projects
craftplanner_time_logs        — Time entries per item
craftplanner_cost_entries     — Cost entries by category with optional supplier
craftplanner_events           — Events with dates, ratings, tags
craftplanner_suppliers        — Supplier directory (name, contact, rating)
craftplanner_item_suppliers   — Many-to-many item-supplier links
craftplanner_photos           — Project photo metadata (files in uploads/)
```

### API

All endpoints are mounted at `/modules/craftplanner/`. Key groups:

- **Projects**: CRUD, progress stats, dashboard aggregates
- **Items**: CRUD, time logging
- **Costs**: Cost entries with supplier linking
- **Suppliers**: CRUD, project suppliers (aggregated from items + costs)
- **Photos**: Multipart upload, listing, deletion, file serving
- **Events**: CRUD with project linking
- **Dashboard**: Activity feed, recent items for QuickLog, shopping list

## Design

The UI uses a warm, dark palette inspired by a craftsperson's workshop:

- Near-black warm background (#110e0a)
- Dark brown surfaces (#1f1a13)
- Warm amber accent (#d4915c)
- Cormorant Garamond display headings, Lexend body text
- Dense layout with progressive disclosure (expandable rows, collapsible sections)

## License

See [LICENSE](LICENSE) files in each component directory.
