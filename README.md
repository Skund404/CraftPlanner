# CraftPlanner

Project management for makers. Track materials, tools, techniques, and progress across any creative craft — cosplay, leatherwork, woodwork, sewing, and more.

## Architecture

- **Core** (Go) — Git-backed catalogue engine managing primitives as JSON files
- **Shell** (Python/FastAPI + React) — UI layer, user data, MCP server
- **Electron** — Desktop wrapper for Windows and Linux

## Quick Start

```bash
# Start the core (requires Go 1.24+)
cd core && go build ./cmd/craftplanner-core/ && ./craftplanner-core

# Start the shell (in another terminal)
cd shell && pip install -r backend/requirements.txt && python -m uvicorn backend.app.main:app --port 3000

# Start frontend dev server (in another terminal)
cd shell/frontend && npm install && npm run dev
```

## Electron

```bash
cd electron && npm install && npm start
```

## License

See [LICENSE](LICENSE) files in each component directory.
