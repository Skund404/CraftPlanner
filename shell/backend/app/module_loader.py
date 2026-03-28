"""Module loader — loads the single inline CraftPlanner module.

CraftPlanner ships with one built-in module that IS the app experience.
There is no package manager, no registry, no installed_modules table.

Loading sequence:
  1. Resolve the module directory at shell/module/
  2. Parse and validate the manifest
  3. Run pending UserDB migrations
  4. Import the backend router
  5. Mount the router on the FastAPI app
  6. Populate the ModuleRegistry
"""

from __future__ import annotations

import importlib.util
import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from types import ModuleType

import structlog
from fastapi import APIRouter, FastAPI

from .module_manifest import ModuleManifest, ModuleEndpoint, ModulePanel, ModuleView
from .userdb import UserDB

log = structlog.get_logger().bind(component="module_loader")

# The inline module lives at shell/module/ relative to the shell root.
_MODULE_NAME = "craftplanner"
_MODULE_DIR = Path(__file__).parent.parent.parent / "module"


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class LoadedModule:
    """A successfully loaded module with its manifest and mounted router."""

    name: str
    manifest: ModuleManifest
    package_path: str | None          # Filesystem path
    router: APIRouter | None = None   # The FastAPI router, if has_backend

    @property
    def mount_prefix(self) -> str:
        return f"/modules/{self.name}"


@dataclass
class FailedModule:
    """A module that failed to load, with the error reason."""

    name: str
    error: str


class ModuleRegistry:
    """Runtime registry of all loaded modules.

    Provides lookups used by the MCP tool generator, dev API, and MCP module tools.
    Stored on app.state.module_registry at startup.
    """

    def __init__(self) -> None:
        self._loaded: list[LoadedModule] = []
        self._failed: list[FailedModule] = []
        self._shell_view_claims: dict[str, str] = {}

    # --- Mutation (only during startup) ---

    def _add_loaded(self, m: LoadedModule) -> None:
        for view in m.manifest.views:
            if view.replaces_shell_view:
                existing = self._shell_view_claims.get(view.replaces_shell_view)
                if existing:
                    log.warning(
                        "shell_view_claim_conflict",
                        shell_view=view.replaces_shell_view,
                        existing_module=existing,
                        new_module=m.name,
                    )
                self._shell_view_claims[view.replaces_shell_view] = m.name
        self._loaded.append(m)

    def _add_failed(self, name: str, error: str) -> None:
        self._failed.append(FailedModule(name=name, error=error))

    # --- Queries ---

    def get_loaded(self) -> list[LoadedModule]:
        return list(self._loaded)

    def get_failed(self) -> list[FailedModule]:
        return list(self._failed)

    def get_module(self, name: str) -> LoadedModule | None:
        return next((m for m in self._loaded if m.name == name), None)

    def is_loaded(self, name: str) -> bool:
        return any(m.name == name for m in self._loaded)

    def get_all_keywords(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for m in self._loaded:
            for kw in m.manifest.keywords:
                result[kw.keyword] = m.name
        return result

    def get_all_views(self) -> list[dict]:
        result = []
        for m in self._loaded:
            for view in m.manifest.views:
                result.append({"module": m.name, **view.model_dump()})
        result.sort(key=lambda v: v["sort_order"])
        return result

    def get_module_views(self, name: str) -> list[ModuleView]:
        loaded = self.get_module(name)
        return list(loaded.manifest.views) if loaded else []

    def get_all_panels(self) -> list[dict]:
        result = []
        for m in self._loaded:
            for panel in m.manifest.panels:
                result.append({"module": m.name, **panel.model_dump()})
        return result

    def get_module_panels(self, name: str) -> list[ModulePanel]:
        loaded = self.get_module(name)
        return list(loaded.manifest.panels) if loaded else []

    def get_all_endpoints(self) -> list[dict]:
        result = []
        for m in self._loaded:
            for ep in m.manifest.api_endpoints:
                result.append({
                    "module_name": m.name,
                    "module_display_name": m.manifest.display_name,
                    **ep.model_dump(),
                })
        return result


# ---------------------------------------------------------------------------
# Manifest + route loading
# ---------------------------------------------------------------------------


def _load_manifest(module_dir: Path) -> ModuleManifest:
    """Read and validate the manifest for the inline module."""
    manifest_path = module_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"manifest.json not found at {manifest_path}")
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    return ModuleManifest.model_validate(raw)


def _import_routes(module_dir: Path) -> ModuleType:
    """Import the module's backend.routes module from the filesystem."""
    routes_path = module_dir / "backend" / "routes.py"
    if not routes_path.exists():
        raise FileNotFoundError(f"backend/routes.py not found at {routes_path}")

    module_key = f"_craftplanner_module_{_MODULE_NAME}_routes"
    spec = importlib.util.spec_from_file_location(module_key, routes_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not create module spec from {routes_path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_key] = mod
    spec.loader.exec_module(mod)
    return mod


def _get_router(routes_module: ModuleType) -> APIRouter:
    """Extract the FastAPI router from the imported routes module."""
    router = getattr(routes_module, "router", None)
    if router is None:
        raise AttributeError(
            f"Module '{_MODULE_NAME}' backend/routes.py must define a `router` attribute."
        )
    if not isinstance(router, APIRouter):
        raise TypeError(
            f"Module '{_MODULE_NAME}' routes.router must be a FastAPI APIRouter, "
            f"got {type(router).__name__}"
        )
    return router


# ---------------------------------------------------------------------------
# Migration runner
# ---------------------------------------------------------------------------


async def _run_module_migrations(module_dir: Path, db: UserDB) -> None:
    """Discover and run any pending migrations for the module.

    Migrations are numbered Python files in backend/migrations/ that expose:
      ID = "migration_id"
      async def up(conn) -> None: ...

    Applied migrations are tracked in the module_migrations table.
    """
    migrations_dir = module_dir / "backend" / "migrations"
    if not migrations_dir.exists():
        return

    conn = db._require_connection()

    # Ensure the inline module has a row in installed_modules so the FK
    # on module_migrations is satisfied.
    await conn.execute(
        "INSERT OR IGNORE INTO installed_modules (name, version, installed_at, enabled, package_path) "
        "VALUES (?, '0.1.0', datetime('now'), 1, ?)",
        (_MODULE_NAME, str(module_dir)),
    )
    await conn.commit()

    cursor = await conn.execute(
        "SELECT migration_id FROM module_migrations WHERE module_name = ?",
        (_MODULE_NAME,),
    )
    applied: set[str] = {row["migration_id"] async for row in cursor}

    migration_files = sorted(migrations_dir.glob("[0-9]*.py"))

    for migration_file in migration_files:
        module_key = f"_craftplanner_module_{_MODULE_NAME}_migration_{migration_file.stem}"
        spec = importlib.util.spec_from_file_location(module_key, migration_file)
        if spec is None or spec.loader is None:
            log.error("module_migration_load_failed", module=_MODULE_NAME, file=str(migration_file))
            continue

        mod = importlib.util.module_from_spec(spec)
        sys.modules[module_key] = mod
        spec.loader.exec_module(mod)

        migration_id: str = getattr(mod, "ID", migration_file.stem)

        if migration_id in applied:
            log.debug("module_migration_already_applied", module=_MODULE_NAME, id=migration_id)
            continue

        log.info("module_migration_applying", module=_MODULE_NAME, id=migration_id)
        start = time.monotonic()

        await mod.up(conn)
        await conn.execute(
            "INSERT INTO module_migrations (module_name, migration_id, applied_at) "
            "VALUES (?, ?, datetime('now'))",
            (_MODULE_NAME, migration_id),
        )
        await conn.commit()

        elapsed_ms = (time.monotonic() - start) * 1000
        log.info(
            "module_migration_applied",
            module=_MODULE_NAME,
            id=migration_id,
            elapsed_ms=round(elapsed_ms, 1),
        )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def load_modules(app: FastAPI, db: UserDB) -> ModuleRegistry:
    """Load the single inline CraftPlanner module.

    Mounts its router on the FastAPI app.
    Returns a populated ModuleRegistry stored on app.state.module_registry.
    """
    registry = ModuleRegistry()
    module_dir = _MODULE_DIR

    if not module_dir.exists():
        log.warning("module_dir_not_found", path=str(module_dir))
        return registry

    manifest_path = module_dir / "manifest.json"
    if not manifest_path.exists():
        log.warning("module_manifest_not_found", path=str(manifest_path))
        return registry

    try:
        # 1. Parse manifest
        manifest = _load_manifest(module_dir)
        log.info("module_manifest_loaded", version=manifest.version)

        # 2. Run migrations
        await _run_module_migrations(module_dir, db)

        # 3. Import backend router
        router: APIRouter | None = None
        if manifest.has_backend:
            routes_module = _import_routes(module_dir)
            router = _get_router(routes_module)

        loaded = LoadedModule(
            name=_MODULE_NAME,
            manifest=manifest,
            package_path=str(module_dir),
            router=router,
        )
        registry._add_loaded(loaded)

        # Mount the FastAPI router
        if loaded.router is not None:
            app.include_router(
                loaded.router,
                prefix=loaded.mount_prefix,
                tags=[f"module:{_MODULE_NAME}"],
            )
            log.info("module_router_mounted", prefix=loaded.mount_prefix)

        log.info(
            "module_loaded",
            keywords=len(loaded.manifest.keywords),
            endpoints=len(loaded.manifest.api_endpoints),
            panels=len(loaded.manifest.panels),
        )

    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}"
        registry._add_failed(_MODULE_NAME, error_msg)
        log.error("module_load_failed", error=error_msg, exc_info=True)

    return registry
