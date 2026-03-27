"""CraftPlanner module — project management API endpoints.

All endpoints are mounted at /modules/craftplanner/ by the module loader.
"""

import json
from datetime import datetime, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter()
log = structlog.get_logger().bind(component="craftplanner")


# ---------------------------------------------------------------------------
# Dependency — get UserDB connection
# ---------------------------------------------------------------------------


def _get_db():
    """Dependency placeholder — overridden by the module loader at mount time."""
    from backend.app.dependencies import get_userdb
    return get_userdb()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    status: str = "planning"
    budget: Optional[float] = None
    deadline: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    primitive_path: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    deadline: Optional[str] = None
    completion_pct: Optional[float] = None
    tags: Optional[list[str]] = None
    primitive_path: Optional[str] = None


class ItemCreate(BaseModel):
    project_id: int
    name: str
    description: str = ""
    item_type: str = "make"
    estimated_cost: Optional[float] = None
    estimated_time_minutes: Optional[int] = None
    quantity: float = 1
    unit: str = "pcs"
    primitive_path: Optional[str] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    item_type: Optional[str] = None
    status: Optional[str] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    estimated_time_minutes: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    primitive_path: Optional[str] = None
    sort_order: Optional[int] = None


class TimeLogCreate(BaseModel):
    minutes: int
    note: str = ""


class EventCreate(BaseModel):
    name: str
    project_id: Optional[int] = None
    description: str = ""
    event_date: Optional[str] = None
    location: str = ""
    rating: Optional[int] = None
    notes: str = ""
    tags: list[str] = Field(default_factory=list)


class EventUpdate(BaseModel):
    name: Optional[str] = None
    project_id: Optional[int] = None
    description: Optional[str] = None
    event_date: Optional[str] = None
    location: Optional[str] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


class CostEntryCreate(BaseModel):
    project_id: int
    item_id: Optional[int] = None
    category: str = "materials"
    description: str = ""
    amount: float
    currency: str = "USD"
    is_estimate: bool = False
    receipt_ref: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _row_to_dict(row) -> dict:
    """Convert an aiosqlite Row to a plain dict."""
    return dict(row)


def _parse_tags(row_dict: dict) -> dict:
    """Parse the JSON tags field to a list."""
    if "tags" in row_dict and isinstance(row_dict["tags"], str):
        try:
            row_dict["tags"] = json.loads(row_dict["tags"])
        except (json.JSONDecodeError, TypeError):
            row_dict["tags"] = []
    return row_dict


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@router.get("/projects")
async def list_projects(
    status: Optional[str] = None,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    db=Depends(_get_db),
):
    clauses = []
    params: list = []
    if status:
        clauses.append("status = ?")
        params.append(status)
    if search:
        clauses.append("(name LIKE ? OR description LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    if tag:
        clauses.append("tags LIKE ?")
        params.append(f'%"{tag}"%')

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = await db.fetch_all(
        f"SELECT * FROM craftplanner_projects{where} ORDER BY updated_at DESC",
        params,
    )
    return [_parse_tags(_row_to_dict(r)) for r in rows]


@router.get("/projects/dashboard")
async def get_dashboard(db=Depends(_get_db)):
    projects = await db.fetch_all("SELECT * FROM craftplanner_projects")
    total = len(projects)
    by_status: dict = {}
    total_budget = 0.0
    total_spent = 0.0
    for p in projects:
        s = p["status"]
        by_status[s] = by_status.get(s, 0) + 1
        if p["budget"]:
            total_budget += p["budget"]

    cost_rows = await db.fetch_all(
        "SELECT SUM(amount) as total FROM craftplanner_cost_entries WHERE is_estimate = 0"
    )
    if cost_rows and cost_rows[0]["total"]:
        total_spent = cost_rows[0]["total"]

    return {
        "total_projects": total,
        "by_status": by_status,
        "total_budget": total_budget,
        "total_spent": total_spent,
    }


@router.get("/projects/{project_id}")
async def get_project(project_id: int, db=Depends(_get_db)):
    rows = await db.fetch_all(
        "SELECT * FROM craftplanner_projects WHERE id = ?", [project_id]
    )
    if not rows:
        raise HTTPException(404, detail="Project not found")
    project = _parse_tags(_row_to_dict(rows[0]))

    items = await db.fetch_all(
        "SELECT * FROM craftplanner_items WHERE project_id = ? ORDER BY sort_order, id",
        [project_id],
    )
    project["items"] = [_row_to_dict(i) for i in items]

    return project


@router.post("/projects", status_code=201)
async def create_project(payload: ProjectCreate, db=Depends(_get_db)):
    now = _now()
    result = await db.execute(
        """INSERT INTO craftplanner_projects
           (name, description, status, budget, deadline, tags, primitive_path, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            payload.name, payload.description, payload.status,
            payload.budget, payload.deadline,
            json.dumps(payload.tags), payload.primitive_path,
            now, now,
        ],
    )
    project_id = result if isinstance(result, int) else result.lastrowid
    log.info("project_created", id=project_id, name=payload.name)
    return {"id": project_id, "name": payload.name}


@router.put("/projects/{project_id}")
async def update_project(project_id: int, payload: ProjectUpdate, db=Depends(_get_db)):
    fields = []
    params: list = []
    data = payload.model_dump(exclude_none=True)
    if "tags" in data:
        data["tags"] = json.dumps(data["tags"])
    for key, val in data.items():
        fields.append(f"{key} = ?")
        params.append(val)
    if not fields:
        raise HTTPException(400, detail="No fields to update")
    fields.append("updated_at = ?")
    params.append(_now())
    params.append(project_id)
    await db.execute(
        f"UPDATE craftplanner_projects SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    return {"ok": True, "id": project_id}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, db=Depends(_get_db)):
    await db.execute("DELETE FROM craftplanner_projects WHERE id = ?", [project_id])
    log.info("project_deleted", id=project_id)
    return {"ok": True}


@router.get("/projects/{project_id}/progress")
async def get_project_progress(project_id: int, db=Depends(_get_db)):
    items = await db.fetch_all(
        "SELECT * FROM craftplanner_items WHERE project_id = ?", [project_id]
    )
    total_items = len(items)
    completed = sum(1 for i in items if i["status"] == "completed")
    total_estimated_cost = sum(i["estimated_cost"] or 0 for i in items)
    total_actual_cost = sum(i["actual_cost"] or 0 for i in items)
    total_estimated_time = sum(i["estimated_time_minutes"] or 0 for i in items)
    total_actual_time = sum(i["actual_time_minutes"] or 0 for i in items)

    cost_rows = await db.fetch_all(
        "SELECT SUM(amount) as total FROM craftplanner_cost_entries WHERE project_id = ? AND is_estimate = 0",
        [project_id],
    )
    cost_spent = cost_rows[0]["total"] if cost_rows and cost_rows[0]["total"] else 0

    return {
        "total_items": total_items,
        "completed_items": completed,
        "completion_pct": round(completed / total_items * 100, 1) if total_items else 0,
        "estimated_cost": total_estimated_cost,
        "actual_cost": total_actual_cost,
        "cost_spent": cost_spent,
        "estimated_time_minutes": total_estimated_time,
        "actual_time_minutes": total_actual_time,
    }


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------


@router.get("/items")
async def list_items(
    project_id: Optional[int] = None,
    item_type: Optional[str] = None,
    status: Optional[str] = None,
    db=Depends(_get_db),
):
    clauses = []
    params: list = []
    if project_id is not None:
        clauses.append("project_id = ?")
        params.append(project_id)
    if item_type:
        clauses.append("item_type = ?")
        params.append(item_type)
    if status:
        clauses.append("status = ?")
        params.append(status)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = await db.fetch_all(
        f"SELECT * FROM craftplanner_items{where} ORDER BY sort_order, id",
        params,
    )
    return [_row_to_dict(r) for r in rows]


@router.post("/items", status_code=201)
async def create_item(payload: ItemCreate, db=Depends(_get_db)):
    now = _now()
    result = await db.execute(
        """INSERT INTO craftplanner_items
           (project_id, name, description, item_type, estimated_cost,
            estimated_time_minutes, quantity, unit, primitive_path, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            payload.project_id, payload.name, payload.description, payload.item_type,
            payload.estimated_cost, payload.estimated_time_minutes,
            payload.quantity, payload.unit, payload.primitive_path,
            now, now,
        ],
    )
    item_id = result if isinstance(result, int) else result.lastrowid
    log.info("item_created", id=item_id, project_id=payload.project_id)
    return {"id": item_id, "project_id": payload.project_id}


@router.put("/items/{item_id}")
async def update_item(item_id: int, payload: ItemUpdate, db=Depends(_get_db)):
    fields = []
    params: list = []
    for key, val in payload.model_dump(exclude_none=True).items():
        fields.append(f"{key} = ?")
        params.append(val)
    if not fields:
        raise HTTPException(400, detail="No fields to update")
    fields.append("updated_at = ?")
    params.append(_now())
    params.append(item_id)
    await db.execute(
        f"UPDATE craftplanner_items SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    return {"ok": True, "id": item_id}


@router.delete("/items/{item_id}")
async def delete_item(item_id: int, db=Depends(_get_db)):
    await db.execute("DELETE FROM craftplanner_items WHERE id = ?", [item_id])
    return {"ok": True}


# ---------------------------------------------------------------------------
# Time Logs
# ---------------------------------------------------------------------------


@router.post("/items/{item_id}/log-time", status_code=201)
async def log_time(item_id: int, payload: TimeLogCreate, db=Depends(_get_db)):
    # Look up the item to get project_id
    rows = await db.fetch_all(
        "SELECT project_id FROM craftplanner_items WHERE id = ?", [item_id]
    )
    if not rows:
        raise HTTPException(404, detail="Item not found")
    project_id = rows[0]["project_id"]

    result = await db.execute(
        """INSERT INTO craftplanner_time_logs (item_id, project_id, minutes, note, logged_at)
           VALUES (?, ?, ?, ?, ?)""",
        [item_id, project_id, payload.minutes, payload.note, _now()],
    )
    log_id = result if isinstance(result, int) else result.lastrowid

    # Update actual_time_minutes on the item
    await db.execute(
        "UPDATE craftplanner_items SET actual_time_minutes = actual_time_minutes + ? WHERE id = ?",
        [payload.minutes, item_id],
    )

    log.info("time_logged", item_id=item_id, minutes=payload.minutes)
    return {"id": log_id, "item_id": item_id, "minutes": payload.minutes}


@router.get("/time-logs")
async def list_time_logs(
    item_id: Optional[int] = None,
    project_id: Optional[int] = None,
    db=Depends(_get_db),
):
    clauses = []
    params: list = []
    if item_id is not None:
        clauses.append("item_id = ?")
        params.append(item_id)
    if project_id is not None:
        clauses.append("project_id = ?")
        params.append(project_id)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = await db.fetch_all(
        f"SELECT * FROM craftplanner_time_logs{where} ORDER BY logged_at DESC",
        params,
    )
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


@router.get("/events")
async def list_events(
    project_id: Optional[int] = None,
    db=Depends(_get_db),
):
    clauses = []
    params: list = []
    if project_id is not None:
        clauses.append("project_id = ?")
        params.append(project_id)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = await db.fetch_all(
        f"SELECT * FROM craftplanner_events{where} ORDER BY event_date DESC NULLS LAST, id DESC",
        params,
    )
    return [_parse_tags(_row_to_dict(r)) for r in rows]


@router.post("/events", status_code=201)
async def create_event(payload: EventCreate, db=Depends(_get_db)):
    now = _now()
    result = await db.execute(
        """INSERT INTO craftplanner_events
           (name, project_id, description, event_date, location, rating, notes, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            payload.name, payload.project_id, payload.description,
            payload.event_date, payload.location, payload.rating,
            payload.notes, json.dumps(payload.tags),
            now, now,
        ],
    )
    event_id = result if isinstance(result, int) else result.lastrowid
    log.info("event_created", id=event_id, name=payload.name)
    return {"id": event_id, "name": payload.name}


@router.put("/events/{event_id}")
async def update_event(event_id: int, payload: EventUpdate, db=Depends(_get_db)):
    fields = []
    params: list = []
    data = payload.model_dump(exclude_none=True)
    if "tags" in data:
        data["tags"] = json.dumps(data["tags"])
    for key, val in data.items():
        fields.append(f"{key} = ?")
        params.append(val)
    if not fields:
        raise HTTPException(400, detail="No fields to update")
    fields.append("updated_at = ?")
    params.append(_now())
    params.append(event_id)
    await db.execute(
        f"UPDATE craftplanner_events SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    return {"ok": True, "id": event_id}


@router.delete("/events/{event_id}")
async def delete_event(event_id: int, db=Depends(_get_db)):
    await db.execute("DELETE FROM craftplanner_events WHERE id = ?", [event_id])
    return {"ok": True}


# ---------------------------------------------------------------------------
# Cost Entries
# ---------------------------------------------------------------------------


@router.get("/costs/{project_id}")
async def get_costs(project_id: int, db=Depends(_get_db)):
    rows = await db.fetch_all(
        "SELECT * FROM craftplanner_cost_entries WHERE project_id = ? ORDER BY created_at DESC",
        [project_id],
    )
    entries = [_row_to_dict(r) for r in rows]

    estimated = sum(e["amount"] for e in entries if e["is_estimate"])
    actual = sum(e["amount"] for e in entries if not e["is_estimate"])

    return {
        "project_id": project_id,
        "entries": entries,
        "total_estimated": estimated,
        "total_actual": actual,
    }


@router.post("/costs", status_code=201)
async def create_cost_entry(payload: CostEntryCreate, db=Depends(_get_db)):
    result = await db.execute(
        """INSERT INTO craftplanner_cost_entries
           (project_id, item_id, category, description, amount, currency, is_estimate, receipt_ref, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            payload.project_id, payload.item_id, payload.category,
            payload.description, payload.amount, payload.currency,
            1 if payload.is_estimate else 0, payload.receipt_ref,
            _now(),
        ],
    )
    cost_id = result if isinstance(result, int) else result.lastrowid
    log.info("cost_entry_created", id=cost_id, project_id=payload.project_id)
    return {"id": cost_id, "project_id": payload.project_id}


# ---------------------------------------------------------------------------
# Shopping List
# ---------------------------------------------------------------------------


@router.get("/shopping-list/{project_id}")
async def get_shopping_list(project_id: int, db=Depends(_get_db)):
    rows = await db.fetch_all(
        """SELECT * FROM craftplanner_items
           WHERE project_id = ? AND item_type = 'buy' AND status != 'completed'
           ORDER BY sort_order, id""",
        [project_id],
    )
    items = [_row_to_dict(r) for r in rows]
    total = sum(i["estimated_cost"] or 0 for i in items)
    return {
        "project_id": project_id,
        "items": items,
        "total_estimated": total,
    }
