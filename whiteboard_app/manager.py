"""Whiteboard manager — persistent, live-synced HTML canvases.

Ported from the aw monolith's ``src/api/whiteboard_manager.py``. A *whiteboard*
is like a presentation, but:

* **Persistent & singular** — it lives at a stable id (default ``main``) and
  stays there across sessions, devices and restarts until something updates it.
* **Live-synced** — every ``set``/``exec_js``/``point`` is broadcast to every
  open viewer over the app's own WebSocket (``/api/apps/whiteboard/ws``), so
  a viewer reloads its iframe (or runs the JS) immediately.
* **Round-trips presentations** — a board can be *loaded* from a presentation
  and *saved* straight back to it (or save-as into a new one). The monolith's
  presentation manager is reached over HTTP (``net:outbound``) rather than an
  in-process import — apps do not import monolith internals.

Storage: unlike the monolith (HTML on disk + metadata in Postgres), everything
here — including the HTML body — lives in one ``db:own-tables`` row. There is
no ``fs:workspace-data`` ``ctx`` facade yet (framework gap, same one this
migration's report flags), so keeping the HTML in the DB avoids depending on
it at all.
"""

from __future__ import annotations

import html as _html
import json
import logging
import re
import time

logger = logging.getLogger("whiteboard_app.manager")

DEFAULT_ID = "main"

TABLE_COLUMNS_SQL = (
    "id text PRIMARY KEY, "
    "title text NOT NULL DEFAULT '', "
    "html text NOT NULL DEFAULT '', "
    "source_presentation_id text, "
    "created_at double precision, "
    "updated_at double precision"
)

# Seed HTML for a brand-new whiteboard so an empty canvas still renders
# something meaningful instead of a blank white square.
_BLANK_HTML = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#0a0a0f;color:#8b8b9a;
    font-family:system-ui,-apple-system,sans-serif;
    display:flex;align-items:center;justify-content:center;text-align:center}
  .hint{opacity:.7;max-width:32ch;line-height:1.5}
</style></head><body>
  <div class="hint">Empty whiteboard.<br>Ask the agent to load a presentation
  or draw something here.</div>
</body></html>"""


class Whiteboard:
    def __init__(self, board_id: str, title: str, html: str,
                 source_presentation_id: str | None = None,
                 created_at: float | None = None, updated_at: float | None = None):
        self.id = board_id
        self.title = title
        self.html = html
        self.source_presentation_id = source_presentation_id
        self.created_at = created_at or time.time()
        self.updated_at = updated_at or time.time()


class WhiteboardManager:
    """Manages persistent whiteboards with WebSocket broadcast for live sync.

    ``ctx.db`` (``db:own-tables``) backs storage; the app's own WS route
    handlers register/unregister themselves as listeners and this manager
    broadcasts by awaiting ``ws.send_text`` directly — no cross-thread
    scheduling needed since every caller already runs on the app's own
    event loop (unlike the monolith original, which had to bridge from
    non-async callers via ``call_soon_threadsafe``).
    """

    def __init__(self, ctx):
        self._ctx = ctx
        self._table = ctx.db.table(f"app__{ctx.app_id}__boards")
        ctx.db.create(self._table, TABLE_COLUMNS_SQL)
        self._listeners: set = set()
        # board_id -> {"view": {...}, "at": ts} — last viewport a viewer
        # reported (which section is at the top, scroll %, etc.).
        self._viewports: dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_viewport(self, board_id: str, view: dict | None) -> None:
        self._viewports[board_id] = {"view": view, "at": time.time()}

    def status(self, board_id: str = DEFAULT_ID) -> dict:
        board = self.ensure(board_id)
        sections = []
        try:
            for tag, inner in re.findall(r"<(h[1-4])[^>]*>(.*?)</\1>", board.html or "", re.I | re.S):
                txt = _html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
                if txt:
                    sections.append({"level": int(tag[1]), "text": txt[:160]})
        except Exception:
            pass
        vp = self._viewports.get(board_id)
        stale = round(time.time() - vp.get("at", 0), 1) if vp else None
        return {
            "id": board.id,
            "title": board.title,
            "source_presentation_id": board.source_presentation_id,
            "html_bytes": len(board.html or ""),
            "viewers_connected": len(self._listeners),
            "sections": sections,
            "viewport": (vp or {}).get("view"),
            "viewport_age_seconds": stale,
        }

    def ensure(self, board_id: str = DEFAULT_ID) -> Whiteboard:
        """Return the board, creating a blank one on first access."""
        board = self._get_row(board_id)
        if board is None:
            board = Whiteboard(board_id, board_id.capitalize(), _BLANK_HTML)
            self._save(board)
        return board

    def get(self, board_id: str = DEFAULT_ID) -> Whiteboard | None:
        return self._get_row(board_id)

    def list_boards(self) -> list[dict]:
        rows = self._ctx.db.execute(
            self._table, "SELECT * FROM {table} ORDER BY id")
        return [self._to_dict(self._row_to_board(r), include_html=False) for r in rows]

    def set_html(self, board_id: str, html: str, title: str | None = None,
                 source_presentation_id: str | None = "__keep__") -> Whiteboard:
        """Replace the whole canvas — every viewer reloads its iframe."""
        board = self._get_row(board_id)
        if board is None:
            board = Whiteboard(board_id, title or board_id.capitalize(), html)
        else:
            board.html = html
            if title is not None:
                board.title = title
        if source_presentation_id != "__keep__":
            board.source_presentation_id = source_presentation_id
        board.updated_at = time.time()
        self._save(board)
        logger.info("Whiteboard set: %s (%s, %d bytes)", board_id, board.title, len(html))
        return board

    def exec_js(self, board_id: str, js: str) -> bool:
        self.ensure(board_id)
        logger.info("Whiteboard exec_js: %s (%d bytes)", board_id, len(js))
        return True

    def point(self, board_id: str, selector: str | None = None, text: str | None = None,
              scroll: bool = True, highlight: bool = True, duration: int = 4000,
              color: str | None = None) -> dict:
        self.ensure(board_id)
        msg = {"type": "whiteboard_point", "id": board_id,
               "scroll": bool(scroll), "highlight": bool(highlight),
               "duration": int(duration)}
        if selector:
            msg["selector"] = selector
        if text:
            msg["text"] = text
        if color:
            msg["color"] = color
        logger.info("Whiteboard point: %s selector=%r text=%r", board_id, selector, text)
        return msg

    def close_view(self, board_id: str) -> dict:
        logger.info("Whiteboard close_view: %s", board_id)
        return {"type": "whiteboard_close", "id": board_id}

    def delete(self, board_id: str) -> bool:
        board = self._get_row(board_id)
        if not board:
            return False
        self._ctx.db.execute(self._table, "DELETE FROM {table} WHERE id = :id", {"id": board_id})
        return True

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _row_to_board(self, row) -> Whiteboard:
        m = row._mapping
        return Whiteboard(m["id"], m["title"], m["html"], m["source_presentation_id"],
                          m["created_at"], m["updated_at"])

    def _get_row(self, board_id: str) -> Whiteboard | None:
        rows = self._ctx.db.execute(
            self._table, "SELECT * FROM {table} WHERE id = :id", {"id": board_id})
        return self._row_to_board(rows[0]) if rows else None

    def _to_dict(self, board: Whiteboard, include_html: bool = True) -> dict:
        d = {
            "id": board.id,
            "title": board.title,
            "source_presentation_id": board.source_presentation_id,
            "created_at": board.created_at,
            "updated_at": board.updated_at,
        }
        if include_html:
            d["html"] = board.html
        return d

    def _save(self, board: Whiteboard):
        self._ctx.db.execute(
            self._table,
            """
            INSERT INTO {table} (id, title, html, source_presentation_id, created_at, updated_at)
            VALUES (:id, :title, :html, :sp, :ca, :ua)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title, html = EXCLUDED.html,
              source_presentation_id = EXCLUDED.source_presentation_id,
              updated_at = EXCLUDED.updated_at
            """,
            {"id": board.id, "title": board.title, "html": board.html,
             "sp": board.source_presentation_id, "ca": board.created_at, "ua": board.updated_at},
        )

    # ------------------------------------------------------------------
    # WebSocket broadcast
    # ------------------------------------------------------------------

    def add_listener(self, ws):
        self._listeners.add(ws)

    def remove_listener(self, ws):
        self._listeners.discard(ws)

    async def broadcast(self, msg: dict):
        if not self._listeners:
            return
        data = json.dumps(msg)
        dead = set()
        for ws in list(self._listeners):
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._listeners.discard(ws)
