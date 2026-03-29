# CLAUDE.md — CraftPlanner

> Read this entire file before doing any work.

---

## Project Identity

- Name: CraftPlanner
- Repo: github.com/Skund404/CraftPlanner
- Type: Standalone desktop app (Electron)
- Stack: Go (core) + Python/FastAPI (shell) + React/TypeScript (frontend)
- Distribution: Windows (NSIS) + Linux (AppImage + deb)

## What CraftPlanner Is

A domain-agnostic project management tool for makers. Users manage creative projects
(cosplay, leatherwork, woodwork, sewing, any craft) using six primitives:

| Primitive   | Default name | Purpose                                      |
|-------------|-------------|----------------------------------------------|
| Material    | Materials   | Things you buy or have (leather, fabric, glue)|
| Tool        | Tools       | Equipment you use (sewing machine, rotary)   |
| Technique   | Techniques  | How-to knowledge (glue application, riveting)|
| Workflow    | Workflows   | Multi-step build processes (wallet assembly) |
| Project     | Projects    | Top-level goals with budget + deadline       |
| Event       | Events      | Occasions where projects are used/shown      |

Additional first-class entities (not primitives):
- **Supplier** — where materials/tools are purchased (rating, contact, linked to items + costs)
- **Photo** — project progress images (uploaded, captioned, gallery view)

All primitive names are user-renamable via workshop settings.

## Architecture

```
CraftPlanner/
├── core/                   # Go binary — Git-backed catalogue of primitives
├── shell/                  # FastAPI + React — UI, UserDB, MCP server
│   ├── backend/            # Python API (port 8400)
│   ├── frontend/           # React + Tailwind v4 + Radix UI
│   │   └── src/
│   │       ├── components/ui/   # Shared UI components (Button, Badge, Dialog, etc.)
│   │       ├── lib/             # api.ts, utils.ts
│   │       └── index.css        # Tailwind v4 theme + CSS custom properties
│   ├── craftplanner_sdk/   # SDK for module integration
│   ├── mcp_server/         # MCP tool server
│   └── module/             # The PM module (inline, always active)
│       ├── backend/
│       │   ├── routes.py        # All API endpoints
│       │   └── migrations/      # 001_initial, 002_ui_enhancements, 003_suppliers_photos
│       └── frontend/
│           ├── index.ts         # Module registration (views, panels, app mode, nav)
│           ├── components/      # Sidebar, QuickLogWidget, panels
│           └── views/           # All page-level views
│               ├── project-detail/   # Decomposed project detail (15 files)
│               ├── DashboardView.tsx
│               ├── ProjectsView.tsx
│               ├── SuppliersView.tsx
│               ├── ShoppingListView.tsx
│               ├── EventsView.tsx
│               ├── CatalogueView.tsx
│               └── SettingsView.tsx
├── electron/               # Electron wrapper (main process)
└── .impeccable.md          # Design system context
```

### Core (Go, port 8420)
- Manages primitives as JSON manifest files in a Git repository
- SQLite read index for fast queries (rebuilt from Git on startup)
- REST API for CRUD + search + relationships
- Extended with: asset metadata, template primitive type, custom fields

### Shell (Python, port 8400)
- FastAPI backend serving the React frontend
- UserDB (SQLite) for user state (projects, time logs, costs, suppliers, photos, etc.)
- Single module always active (no package manager, no multi-module)
- App-mode only — no shell sidebar, user lands directly in the app
- MCP server exposing all tools
- Photo uploads stored in `shell/uploads/photos/` (filesystem, not Git)

### Frontend (React + TypeScript)
- Tailwind v4 with CSS custom properties (`--cp-*` prefix)
- Radix UI primitives for accessible components
- React Query (TanStack) for all data fetching with query key invalidation
- TipTap rich text editor with `[[` autocomplete linking (not used in Notes — structured textareas instead)
- React Flow for node/graph visualization
- Three themes: workshop-dark (default), daylight, high-contrast

## Project Detail Architecture

The project detail view is the heart of the app. It was decomposed from a monolithic
1727-line file into focused sub-components in `module/frontend/views/project-detail/`:

| File                    | Purpose                                           |
|-------------------------|---------------------------------------------------|
| `ProjectDetailView.tsx` | Slim composition root (~170 lines) — queries, mutations, tab routing |
| `types.ts`              | All shared interfaces (Project, ProjectItem, Supplier, Photo, etc.) |
| `helpers.ts`            | formatTime, formatCurrency, parseNotes, serializeNotes, etc. |
| `ProjectHeader.tsx`     | Name, status lifecycle buttons, 5-cell stat grid  |
| `ActionBar.tsx`         | Sticky bottom bar with quick actions              |
| `ItemsTab.tsx`          | Make/buy items with expandable detail rows, filters |
| `TasksTab.tsx`          | Task checklist with progress bar                  |
| `BudgetTab.tsx`         | Cost summary, category breakdown bar, cost entries |
| `TimeLogTab.tsx`        | Time stats, per-item bars, daily timeline         |
| `EventsTab.tsx`         | Linked events with ratings                        |
| `SuppliersTab.tsx`      | Project suppliers with contact/rating/spend cards |
| `GalleryTab.tsx`        | Photo grid, upload, lightbox viewer               |
| `NotesTab.tsx`          | 4 structured sections (client/construction/lessons/general) with auto-save |
| `AddItemDialog.tsx`     | Item creation with supplier dropdown              |
| `EditProjectDialog.tsx` | Project editing + delete                          |
| `index.ts`              | Re-exports ProjectDetailView                      |

8 tabs: Items | Tasks | Budget | Time Log | Events | Suppliers | Gallery | Notes

## Data Model (UserDB tables)

```
craftplanner_projects         — id, name, description, status, budget, deadline, tags (JSON), notes, ...
craftplanner_items            — id, project_id FK, name, item_type (make/buy/task), status, estimated_cost, ...
craftplanner_time_logs        — id, item_id FK, project_id FK, minutes, note, logged_at
craftplanner_cost_entries     — id, project_id FK, category, amount, is_estimate, supplier_id FK, ...
craftplanner_events           — id, project_id FK, name, event_date, location, rating, tags (JSON), ...
craftplanner_suppliers        — id, name, website, contact_email, contact_phone, address, notes, rating, tags (JSON)
craftplanner_item_suppliers   — id, item_id FK, supplier_id FK (junction, UNIQUE)
craftplanner_photos           — id, project_id FK, item_id FK (nullable), caption, file_path, created_at
```

## API Endpoints (mounted at /modules/craftplanner/)

### Projects
- `GET/POST /projects` — list (search, status filter) / create
- `GET/PUT/DELETE /projects/{id}` — single project CRUD
- `GET /projects/{id}/progress` — computed progress stats
- `GET /projects/dashboard` — aggregate stats

### Items
- `POST /items` — create item
- `PUT/DELETE /items/{id}` — update / delete
- `POST /items/{id}/log-time` — log time against item

### Costs
- `GET /costs/{project_id}` — cost entries + totals
- `POST /costs` — create cost entry (with optional supplier_id)

### Time Logs
- `GET /time-logs?project_id=X` — time logs for project

### Events
- `GET/POST /events` — list / create
- `GET/PUT/DELETE /events/{id}` — single event CRUD

### Suppliers
- `GET/POST /suppliers` — list / create
- `GET/PUT/DELETE /suppliers/{id}` — single supplier CRUD
- `GET /projects/{project_id}/suppliers` — suppliers linked to project (via items + costs)
- `GET/POST/DELETE /items/{item_id}/suppliers/{supplier_id}` — link/unlink supplier to item

### Photos
- `POST /photos` — multipart upload (10MB limit, image types only)
- `GET /photos?project_id=X` — list photos
- `DELETE /photos/{id}` — delete photo + file
- `GET /photos/file/{filename}` — serve photo file

### Dashboard
- `GET /dashboard/activity?limit=N` — recent time logs + cost entries
- `GET /dashboard/recent-items` — items from active projects (for QuickLog)
- `GET /shopping-list` — buy items grouped by project

## Key Features

### Structured Notes
Notes are stored as JSON in the project's `notes` field with 4 sections:
```json
{ "client": "...", "construction": "...", "lessons": "...", "general": "..." }
```
Legacy plain text is auto-migrated to the `general` section via `parseNotes()`.

### Supplier Tracking
Suppliers are first-class entities linked to items via a many-to-many junction table
(`craftplanner_item_suppliers`) and to cost entries via `supplier_id` FK. The project
suppliers tab aggregates both relationships.

### Photo Gallery
Photos are uploaded via multipart POST, stored with UUID filenames in `shell/uploads/photos/`,
and served via a static file endpoint. The gallery supports lightbox navigation.

### Custom Fields + Units
Primitives support user-defined fields with typed units:
```json
{
  "custom_fields": {
    "_template": "leather",
    "sections": [
      {
        "name": "Physical Properties",
        "fields": [
          { "key": "thickness", "label": "Thickness", "value": 2.5, "unit": "mm", "unit_type": "length" }
        ]
      }
    ]
  }
}
```
Data stored in base units (mm, g, ml, C). Frontend converts for display based on metric/imperial toggle.

### Templates
Stored as a primitive type. Define reusable field presets for any primitive.
Users create templates through a UI form builder, never by editing JSON.

### Asset Metadata (Binary Files)
Binary files are NOT stored in Git. Instead, a `.meta.json` sidecar lives in the primitive's `assets/` directory:
```
projects/wallet/assets/photo.meta.json
```
Core indexes these during its catalogue walk. The metadata tracks local path, checksums, backup paths.

### Primitive Linking ("Wheel with Spokes")
Any primitive can link to any other via:
- `[[path|Display Name]]` inline links in text fields (wiki-style, rendered as clickable chips)
- `relationships[]` array in the primitive manifest (structured links)
- Basket sidebar: collect primitives, then batch-connect them
- Node view: visual graph of all connections

### Workshops
Separate user profiles with own data, settings, and preferences. Each workshop stores:
- `primitive_names` — rename map (e.g. `{"materials": "Fabrics"}`)
- `unit_system` — metric or imperial
- `theme` — workshop-dark, daylight, or high-contrast

## Visual Design

The UI uses a warm, dark palette designed to feel like a craftsperson's workshop:

- Background: near-black warmth (`#110e0a`)
- Surface: dark brown (`#1f1a13`)
- Accent: warm amber (`#d4915c`)
- Typography: 13px base, `Lexend` body, `Cormorant Garamond` display headings
- Dense layout with small font sizes (9-13px), uppercase tracking labels
- `.text-label` utility: 10px uppercase tracking-wider text-text-faint

Component sizes:
- Button: `xs` (h-6), `sm` (h-8), `md` (h-9), `lg` (h-10)
- Badge: `sm` (tight padding), `md` (default)
- Tabs: compact triggers (px-2.5 py-1.5 text-[11px])

## Code Standards

- CSS vars: `--cp-*` prefix (not `--ms-*`)
- Python: async, Pydantic 2.x, typed
- Go: standard library style, `internal/` packages
- React: functional components, hooks only
- All API calls go through `apiGet`, `apiPost`, `apiPut`, `apiDelete`, `apiUpload` in `lib/api.ts`
- React Query keys follow pattern: `['entity', id]` or `['entity', id, 'sub-entity']`
- Accessibility: WCAG AAA target, 44px touch targets, keyboard navigable, reduced motion support
- All migrations have up() and down()

## Design Principles

1. **Primitives, not complexity** — abstract technical concepts behind craft metaphors
2. **Progressive disclosure** — simple path first, depth when you reach for it
3. **Connected, not tangled** — linking should feel like corkboard + string, not circuit wiring
4. **Every workshop is different** — renamable everything, custom templates, unit toggle
5. **Accessible by default** — WCAG AAA, Lexend font, reduced motion, high contrast theme

## Build / Test

```bash
# Core
cd core && go test ./...

# Shell backend
cd shell && python3 -m pytest backend/tests/ -q

# Frontend (from shell/frontend)
cd shell/frontend && npm run build

# Frontend dev server
cd shell/frontend && npm run dev
```

## Sidebar Navigation

The sidebar is structured into sections:

- **Overview**: Dashboard, Projects, Shopping List
- **Catalogue**: Materials, Tools, Techniques, Workflows
- **Resources**: Suppliers
- **Occasions**: Events
- **Bottom**: Settings (pinned), QuickLog widget (timer + item selector + API logging)
