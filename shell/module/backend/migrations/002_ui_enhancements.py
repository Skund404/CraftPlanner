"""Add notes and cover_image to projects, expand item_type to include task."""

ID = "002_ui_enhancements"


async def up(conn) -> None:
    await conn.executescript("""
        ALTER TABLE craftplanner_projects ADD COLUMN notes TEXT NOT NULL DEFAULT '';
        ALTER TABLE craftplanner_projects ADD COLUMN cover_image TEXT NOT NULL DEFAULT '';

        -- SQLite doesn't support ALTER CHECK, so recreate items table with expanded constraint.
        CREATE TABLE craftplanner_items_new (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id    INTEGER NOT NULL REFERENCES craftplanner_projects(id) ON DELETE CASCADE,
            name          TEXT NOT NULL,
            description   TEXT NOT NULL DEFAULT '',
            item_type     TEXT NOT NULL DEFAULT 'make'
                          CHECK (item_type IN ('buy', 'make', 'task')),
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

        INSERT INTO craftplanner_items_new SELECT * FROM craftplanner_items;

        DROP TABLE craftplanner_items;
        ALTER TABLE craftplanner_items_new RENAME TO craftplanner_items;

        CREATE INDEX IF NOT EXISTS idx_craftplanner_items_project
            ON craftplanner_items(project_id);
    """)


async def down(conn) -> None:
    await conn.executescript("""
        -- Remove notes and cover_image columns by recreating
        CREATE TABLE craftplanner_projects_old AS
            SELECT id, name, description, status, budget, deadline,
                   completion_pct, tags, primitive_path, created_at, updated_at
            FROM craftplanner_projects;

        DROP TABLE craftplanner_projects;

        CREATE TABLE craftplanner_projects (
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

        INSERT INTO craftplanner_projects SELECT * FROM craftplanner_projects_old;
        DROP TABLE craftplanner_projects_old;

        -- Revert items table to original constraint
        CREATE TABLE craftplanner_items_old (
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

        INSERT INTO craftplanner_items_old
            SELECT * FROM craftplanner_items WHERE item_type != 'task';

        DROP TABLE craftplanner_items;
        ALTER TABLE craftplanner_items_old RENAME TO craftplanner_items;

        CREATE INDEX IF NOT EXISTS idx_craftplanner_items_project
            ON craftplanner_items(project_id);
    """)
