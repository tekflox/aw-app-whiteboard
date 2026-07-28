"""End-to-end test of manager.py + routes.py against a real FastAPI
TestClient, with ``ctx.db`` faked by an in-memory sqlite3 connection (same
SQL shape as the real Postgres-backed DbFacade — ``{table}`` placeholder,
``ON CONFLICT ... DO UPDATE``, which sqlite3 3.24+ also supports). Mirrors
the pattern used by the sibling ``tekflox/aw-app-presentations`` migration.

Run: .venv/aw/bin/python -m pytest tests/test_manager_and_routes.py
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from whiteboard_app import routes as routes_mod  # noqa: E402
from whiteboard_app.browser import WhiteboardBrowser  # noqa: E402
from whiteboard_app.manager import WhiteboardManager  # noqa: E402


class FakeDb:
    def __init__(self):
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self.conn.row_factory = sqlite3.Row

    def table(self, name):
        return name

    def create(self, name, columns_sql):
        self.conn.execute(f"CREATE TABLE IF NOT EXISTS {name} ({columns_sql})")
        self.conn.commit()
        return name

    def execute(self, name, sql, params=None):
        stmt = sql.replace("{table}", name)
        cur = self.conn.execute(stmt, params or {})
        self.conn.commit()
        if stmt.strip().lower().startswith("select"):
            return [_Row(dict(r)) for r in cur.fetchall()]
        return cur


class _Row:
    """Mimics SQLAlchemy Row's ``._mapping`` access used by manager.py."""

    def __init__(self, d):
        self._mapping = d


class FakeCtx:
    def __init__(self):
        self.app_id = "whiteboard"
        self.db = FakeDb()
        self.config = {}


@pytest.fixture
def mgr():
    return WhiteboardManager(FakeCtx())


@pytest.fixture
def client(mgr, tmp_path):
    browser = WhiteboardBrowser(str(tmp_path))
    app = routes_mod.build_routes(FakeCtx(), mgr, browser, str(tmp_path), "http://127.0.0.1:9030")
    return TestClient(app)


def test_ensure_creates_blank_board(client):
    got = client.get("/boards/main").json()
    assert got["id"] == "main"
    assert "Empty whiteboard" in got["html"]


def test_set_board_and_list(client):
    resp = client.put("/boards/main", json={"html": "<h1>Hi</h1>", "title": "Hello"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["title"] == "Hello"

    listed = client.get("/boards").json()
    assert len(listed) == 1
    assert listed[0]["id"] == "main"
    assert "html" not in listed[0]


def test_get_html_and_status(client):
    client.put("/boards/main", json={"html": "<h2>Section</h2>"})

    html_resp = client.get("/boards/main/html")
    assert html_resp.status_code == 200
    assert "<h2>Section</h2>" in html_resp.text

    status = client.get("/boards/main/status").json()
    assert status["id"] == "main"
    assert status["sections"][0]["text"] == "Section"


def test_delete_board(client):
    client.put("/boards/scratch", json={"html": "<p>x</p>"})
    deleted = client.delete("/boards/scratch").json()
    assert deleted["success"] is True

    # ensure() re-creates a blank board — delete doesn't 404, it recreates.
    got = client.get("/boards/scratch").json()
    assert "Empty whiteboard" in got["html"]


def test_view_shell_renders(client):
    resp = client.get("/view/main")
    assert resp.status_code == 200
    assert "/api/apps/whiteboard/ws" in resp.text
    assert "/api/apps/whiteboard/boards/" in resp.text
    assert 'var BOARD = "main"' in resp.text


def test_presentation_roundtrip_501_when_unconfigured(client):
    resp = client.post("/boards/main/save_presentation", json={})
    assert resp.status_code == 501

    resp2 = client.post("/boards/main/load_presentation", json={"presentation_id": "x"})
    assert resp2.status_code == 501


def test_websocket_init_and_set_broadcast(client):
    with client.websocket_connect("/ws") as ws:
        init = ws.receive_json()
        assert init["type"] == "whiteboard_init"
        assert isinstance(init["boards"], list)

        client.put("/boards/main", json={"html": "<p>live</p>"})
        update = ws.receive_json()
        assert update["type"] == "whiteboard_update"
        assert update["action"] == "set"
