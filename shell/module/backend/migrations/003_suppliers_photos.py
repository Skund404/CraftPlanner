"""Add suppliers, item-supplier links, photos, and supplier_id on cost entries."""

ID = "003_suppliers_photos"


async def up(conn) -> None:
    await conn.executescript("""
        CREATE TABLE IF NOT EXISTS craftplanner_suppliers (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            website       TEXT NOT NULL DEFAULT '',
            contact_email TEXT NOT NULL DEFAULT '',
            contact_phone TEXT NOT NULL DEFAULT '',
            address       TEXT NOT NULL DEFAULT '',
            notes         TEXT NOT NULL DEFAULT '',
            rating        INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
            tags          TEXT NOT NULL DEFAULT '[]',
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS craftplanner_item_suppliers (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id       INTEGER NOT NULL REFERENCES craftplanner_items(id) ON DELETE CASCADE,
            supplier_id   INTEGER NOT NULL REFERENCES craftplanner_suppliers(id) ON DELETE CASCADE,
            UNIQUE(item_id, supplier_id)
        );

        CREATE TABLE IF NOT EXISTS craftplanner_photos (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id    INTEGER NOT NULL REFERENCES craftplanner_projects(id) ON DELETE CASCADE,
            item_id       INTEGER REFERENCES craftplanner_items(id) ON DELETE SET NULL,
            caption       TEXT NOT NULL DEFAULT '',
            file_path     TEXT NOT NULL,
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        ALTER TABLE craftplanner_cost_entries
            ADD COLUMN supplier_id INTEGER REFERENCES craftplanner_suppliers(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_craftplanner_item_suppliers_item
            ON craftplanner_item_suppliers(item_id);

        CREATE INDEX IF NOT EXISTS idx_craftplanner_item_suppliers_supplier
            ON craftplanner_item_suppliers(supplier_id);

        CREATE INDEX IF NOT EXISTS idx_craftplanner_photos_project
            ON craftplanner_photos(project_id);

        CREATE INDEX IF NOT EXISTS idx_craftplanner_photos_item
            ON craftplanner_photos(item_id);
    """)


async def down(conn) -> None:
    await conn.executescript("""
        DROP TABLE IF EXISTS craftplanner_photos;
        DROP TABLE IF EXISTS craftplanner_item_suppliers;
        DROP TABLE IF EXISTS craftplanner_suppliers;

        -- Remove supplier_id from cost_entries by recreating
        CREATE TABLE craftplanner_cost_entries_old AS
            SELECT id, project_id, item_id, category, description,
                   amount, currency, is_estimate, receipt_ref, created_at
            FROM craftplanner_cost_entries;

        DROP TABLE craftplanner_cost_entries;

        CREATE TABLE craftplanner_cost_entries (
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

        INSERT INTO craftplanner_cost_entries
            (id, project_id, item_id, category, description, amount, currency, is_estimate, receipt_ref, created_at)
            SELECT * FROM craftplanner_cost_entries_old;

        DROP TABLE craftplanner_cost_entries_old;

        CREATE INDEX IF NOT EXISTS idx_craftplanner_cost_entries_project
            ON craftplanner_cost_entries(project_id);
    """)
