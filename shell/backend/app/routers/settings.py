"""Settings routes — user preferences and theme management.

All preferences are stored in UserDB as JSON-encoded key-value pairs.
"""

import json

import structlog
from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_userdb
from ..models import ThemeData, ThemeInfo, ThemeSet, UserPreferences
from ..userdb import UserDB

log = structlog.get_logger().bind(component="settings_router")

router = APIRouter(prefix="/api/settings", tags=["settings"])

_DEFAULT_USER_ID = "default"
_THEME_KEY = "active_theme"
_DEFAULT_THEME = "workshop-dark"


async def _get_prefs(db: UserDB) -> dict:
    """Read all preferences for the default user as a decoded dict."""
    rows = await db.fetch_all(
        "SELECT key, value FROM user_preferences WHERE user_id = ?",
        [_DEFAULT_USER_ID],
    )
    prefs: dict = {}
    for row in rows:
        try:
            prefs[row["key"]] = json.loads(row["value"])
        except (json.JSONDecodeError, TypeError):
            prefs[row["key"]] = row["value"]
    return prefs


async def _set_pref(db: UserDB, key: str, value) -> None:
    """Upsert a single preference key for the default user."""
    await db.execute(
        """
        INSERT INTO user_preferences (user_id, key, value)
        VALUES (?, ?, ?)
        ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value
        """,
        [_DEFAULT_USER_ID, key, json.dumps(value)],
    )


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------


@router.get("", response_model=UserPreferences, summary="Get all settings")
async def get_settings(
    db: UserDB = Depends(get_userdb),
) -> UserPreferences:
    """Return all user preferences as a flat key-value map."""
    prefs = await _get_prefs(db)
    return UserPreferences(preferences=prefs)


@router.put("/preferences", response_model=UserPreferences, summary="Update user preferences")
async def update_preferences(
    payload: UserPreferences,
    db: UserDB = Depends(get_userdb),
) -> UserPreferences:
    """Merge the provided preferences into the stored set.

    Existing keys not present in the payload are unchanged.
    To clear a preference, set its value to null.
    """
    for key, value in payload.preferences.items():
        if value is None:
            await db.execute(
                "DELETE FROM user_preferences WHERE user_id = ? AND key = ?",
                [_DEFAULT_USER_ID, key],
            )
        else:
            await _set_pref(db, key, value)

    log.info("preferences_updated", keys=list(payload.preferences.keys()))
    prefs = await _get_prefs(db)
    return UserPreferences(preferences=prefs)


# ---------------------------------------------------------------------------
# Theme
# ---------------------------------------------------------------------------


@router.get("/theme", response_model=ThemeInfo, summary="Get active theme")
async def get_theme(
    db: UserDB = Depends(get_userdb),
) -> ThemeInfo:
    """Return the active theme name."""
    prefs = await _get_prefs(db)
    return ThemeInfo(name=str(prefs.get(_THEME_KEY, _DEFAULT_THEME)))


_BUILTIN_THEMES: dict[str, dict[str, str]] = {
    "workshop-dark": {
        "--cp-bg":             "#1a1410",
        "--cp-bg-secondary":   "#211c15",
        "--cp-surface":        "#2a2218",
        "--cp-surface-el":     "#332a1e",
        "--cp-accent":         "#d4915c",
        "--cp-accent-dim":     "rgba(212, 145, 92, 0.12)",
        "--cp-accent-border":  "rgba(212, 145, 92, 0.25)",
        "--cp-secondary":      "#7a9a6d",
        "--cp-text":           "#e8ddd0",
        "--cp-text-muted":     "#9a8b7a",
        "--cp-text-faint":     "#5a4e42",
        "--cp-border":         "#2a2218",
        "--cp-border-bright":  "#3a3025",
        "--cp-success":        "#7a9a6d",
        "--cp-warning":        "#d4a23c",
        "--cp-danger":         "#c45c4a",
        "--cp-radius":         "0.5rem",
    },
    "daylight": {
        "--cp-bg":             "#f5f0eb",
        "--cp-bg-secondary":   "#ede5dc",
        "--cp-surface":        "#ffffff",
        "--cp-surface-el":     "#ffffff",
        "--cp-accent":         "#b07340",
        "--cp-accent-dim":     "rgba(176, 115, 64, 0.1)",
        "--cp-accent-border":  "rgba(176, 115, 64, 0.25)",
        "--cp-secondary":      "#5a7a4d",
        "--cp-text":           "#2a1f14",
        "--cp-text-muted":     "#6b5d50",
        "--cp-text-faint":     "#a89888",
        "--cp-border":         "#ddd4c8",
        "--cp-border-bright":  "#c8bdb0",
        "--cp-success":        "#5a7a4d",
        "--cp-warning":        "#b08a2c",
        "--cp-danger":         "#a84838",
        "--cp-radius":         "0.5rem",
    },
    "high-contrast": {
        "--cp-bg":             "#000000",
        "--cp-bg-secondary":   "#0a0a0a",
        "--cp-surface":        "#141414",
        "--cp-surface-el":     "#1e1e1e",
        "--cp-accent":         "#ffff00",
        "--cp-accent-dim":     "rgba(255, 255, 0, 0.15)",
        "--cp-accent-border":  "rgba(255, 255, 0, 0.5)",
        "--cp-secondary":      "#00ff00",
        "--cp-text":           "#ffffff",
        "--cp-text-muted":     "#cccccc",
        "--cp-text-faint":     "#888888",
        "--cp-border":         "#333333",
        "--cp-border-bright":  "#555555",
        "--cp-success":        "#00ff00",
        "--cp-warning":        "#ffff00",
        "--cp-danger":         "#ff0000",
        "--cp-radius":         "0",
    },
}


@router.get("/theme/data", response_model=ThemeData, summary="Get active theme data (CSS variables)")
async def get_theme_data(
    db: UserDB = Depends(get_userdb),
) -> ThemeData:
    """Return the full CSS variable set for the active theme.

    The frontend theme loader calls this endpoint on startup and injects
    the variables as CSS custom properties on :root.
    """
    prefs = await _get_prefs(db)
    name = str(prefs.get(_THEME_KEY, _DEFAULT_THEME))
    variables = _BUILTIN_THEMES.get(name, _BUILTIN_THEMES[_DEFAULT_THEME])
    return ThemeData(name=name, variables=variables)


@router.put("/theme", response_model=ThemeInfo, summary="Switch theme")
async def set_theme(
    payload: ThemeSet,
    db: UserDB = Depends(get_userdb),
) -> ThemeInfo:
    """Switch the active theme (stored in user preferences)."""
    await _set_pref(db, _THEME_KEY, payload.name)
    log.info("theme_set", name=payload.name)
    return ThemeInfo(name=payload.name)
