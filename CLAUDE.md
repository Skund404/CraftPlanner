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

All primitive names are user-renamable via workshop settings.

## Architecture

```
CraftPlanner/
├── core/           # Go binary — Git-backed catalogue of primitives
├── shell/          # FastAPI + React — UI, UserDB, MCP server
│   ├── backend/    # Python API
│   ├── frontend/   # React + Tailwind v4 + Radix UI
│   ├── craftplanner_sdk/  # SDK for module integration
│   ├── mcp_server/ # MCP tool server
│   └── module/     # The PM module (inline, always active)
├── electron/       # Electron wrapper (main process)
└── .impeccable.md  # Design system context
```

### Core (Go, port 8420)
- Manages primitives as JSON manifest files in a Git repository
- SQLite read index for fast queries (rebuilt from Git on startup)
- REST API for CRUD + search + relationships
- Extended with: asset metadata, template primitive type, custom fields

### Shell (Python, port 8400)
- FastAPI backend serving the React frontend
- UserDB (SQLite) for user state (projects, time logs, costs, etc.)
- Single module always active (no package manager, no multi-module)
- App-mode only — no shell sidebar, user lands directly in the app
- MCP server exposing all tools

### Frontend (React + TypeScript)
- Tailwind v4 with CSS custom properties (`--cp-*` prefix)
- Radix UI primitives for accessible components
- TipTap rich text editor with `[[` autocomplete linking
- React Flow for node/graph visualization
- Three themes: workshop-dark (default), daylight, high-contrast

## Key Features

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
Data stored in base units (mm, g, ml, °C). Frontend converts for display based on metric/imperial toggle.

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

## Code Standards

- CSS vars: `--cp-*` prefix (not `--ms-*`)
- Python: async, Pydantic 2.x, typed
- Go: standard library style, `internal/` packages
- React: functional components, hooks only
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

# Frontend
cd shell/frontend && npm run build
```
