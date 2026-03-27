"""Initial CraftPlanner tables — projects, items, time logs, events, cost entries."""

ID = "001_initial"


async def up(conn) -> None:
    await conn.executescript("""
        CREATE TABLE IF NOT EXISTS craftplanner_projects (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            description   TEXT NOT NULL DEFAULT '',
            status        TEXT NOT NULL DEFAULT 'planning'
                          CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),
            budget        REAL,
            deadline      TEXT,
            completion_pct REAL NOT NULL DEFAULT 0.0,
            tags          TEXT NOT NULL DEFAULT '[]',
            primitive_path TEXT,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS craftplanner_items (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id    INTEGER NOT NULL REFERENCES craftplanner_projects(id) ON DELETE CASCADE,
            name          TEXT NOT NULL,
            description   TEXT NOT NULL DEFAULT '',
            item_type     TEXT NOT NULL DEFAULT 'make'
                          CHECK (item_type IN ('buy', 'make')),
            status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
            estimated_cost REAL,
            actual_cost    REAL,
            estimated_time_minutes INTEGER,
            actual_time_minutes    INTEGER NOT NULL DEFAULT 0,
            quantity      REAL NOT NULL DEFAULT 1,
            unit          TEXT NOT NULL DEFAULT 'pcs',
            primitive_path TEXT,
            sort_order    INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS craftplanner_time_logs (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id       INTEGER NOT NULL REFERENCES craftplanner_items(id) ON DELETE CASCADE,
            project_id    INTEGER NOT NULL REFERENCES craftplanner_projects(id) ON DELETE CASCADE,
            minutes       INTEGER NOT NULL,
            note          TEXT NOT NULL DEFAULT '',
            logged_at     TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS craftplanner_events (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id    INTEGER REFERENCES craftplanner_projects(id) ON DELETE SET NULL,
            name          TEXT NOT NULL,
            description   TEXT NOT NULL DEFAULT '',
            event_date    TEXT,
            location      TEXT NOT NULL DEFAULT '',
            rating        INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
            notes         TEXT NOT NULL DEFAULT '',
            tags          TEXT NOT NULL DEFAULT '[]',
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS craftplanner_cost_entries (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id    INTEGER NOT NULL REFERENCES craftplanner_projects(id) ON DELETE CASCADE,
            item_id       INTEGER REFERENCES craftplanner_items(id) ON DELETE SET NULL,
            category      TEXT NOT NULL DEFAULT 'materials'
                          CHECK (category IN ('materials', 'tools', 'services', 'shipping', 'other')),
            description   TEXT NOT NULL DEFAULT '',
            amount        REAL NOT NULL,
            currency      TEXT NOT NULL DEFAULT 'USD',
            is_estimate   INTEGER NOT NULL DEFAULT 0,
            receipt_ref   TEXT,
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_craftplanner_items_project
            ON craftplanner_items(project_id);

        CREATE INDEX IF NOT EXISTS idx_craftplanner_time_logs_item
            ON craftplanner_time_logs(item_id);

        CREATE INDEX IF NOT EXISTS idx_craftplanner_time_logs_project
            ON craftplanner_time_logs(project_id);

        CREATE INDEX IF NOT EXISTS idx_craftplanner_cost_entries_project
            ON craftplanner_cost_entries(project_id);

        CREATE INDEX IF NOT EXISTS idx_craftplanner_events_project
            ON craftplanner_events(project_id);
    """)


async def down(conn) -> None:
    await conn.executescript("""
        DROP TABLE IF EXISTS craftplanner_cost_entries;
        DROP TABLE IF EXISTS craftplanner_time_logs;
        DROP TABLE IF EXISTS craftplanner_items;
        DROP TABLE IF EXISTS craftplanner_events;
        DROP TABLE IF EXISTS craftplanner_projects;
    """)
