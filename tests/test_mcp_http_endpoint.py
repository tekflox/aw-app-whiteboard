"""Tests for the in-process MCP endpoint (whiteboard_app/mcp/http_handler.py,
mounted as POST/GET /mcp by routes.py) and self-registration
(whiteboard_app/mcp/self_register.py) — the mechanism aw-mcp-gateway's
app-scan uses to auto-discover this app's MCP tools, no external process or
manual wiring needed (contrast with mcp_server/, a genuinely separate
standalone process for callers outside the workspace).

Reuses test_manager_and_routes.py's FakeDb/FakeCtx/client fixtures via a
local sys.path insert (same convention that file itself uses).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from whiteboard_app import routes as routes_mod  # noqa: E402
from whiteboard_app.browser import WhiteboardBrowser  # noqa: E402
from whiteboard_app.manager import WhiteboardManager  # noqa: E402
from whiteboard_app.mcp import self_register  # noqa: E402


class FakeDb:
    import sqlite3

    def __init__(self):
        self.conn = self.sqlite3.connect(":memory:", check_same_thread=False)
        self.conn.row_factory = self.sqlite3.Row

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
    def __init__(self, d):
        self._mapping = d


class FakeCtx:
    def __init__(self, config=None):
        self.app_id = "whiteboard"
        self.db = FakeDb()
        self.config = config or {}


@pytest.fixture
def mgr():
    return WhiteboardManager(FakeCtx())


@pytest.fixture
def client(mgr, tmp_path):
    browser = WhiteboardBrowser(str(tmp_path))
    app = routes_mod.build_routes(FakeCtx(), mgr, browser, str(tmp_path), "http://127.0.0.1:9030")
    return TestClient(app)


def _call(client, name, arguments=None, req_id=1):
    return client.post("/mcp", json={
        "jsonrpc": "2.0", "id": req_id, "method": "tools/call",
        "params": {"name": name, "arguments": arguments or {}},
    })


def test_initialize(client):
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"]["serverInfo"]["name"] == "aw-app-whiteboard"


def test_tools_list_includes_all_tools(client):
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    names = {t["name"] for t in resp.json()["result"]["tools"]}
    assert "whiteboard_show_html" in names
    assert "whiteboard_load_presentation" in names
    assert "whiteboard_browser_close" in names


def test_get_mcp_returns_405(client):
    assert client.get("/mcp").status_code == 405


def test_show_html_then_get_round_trip(client):
    resp = _call(client, "whiteboard_show_html", {"html": "<h1>Hi from MCP</h1>", "title": "MCP Test"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"]["isError"] is False
    assert "updated" in body["result"]["content"][0]["text"]

    resp2 = _call(client, "whiteboard_get")
    payload = json.loads(resp2.json()["result"]["content"][0]["text"])
    assert payload["title"] == "MCP Test"
    assert payload["html"] == "<h1>Hi from MCP</h1>"


def test_whiteboard_list_empty_then_populated(client):
    resp = _call(client, "whiteboard_list")
    assert "No whiteboards yet" in resp.json()["result"]["content"][0]["text"]

    _call(client, "whiteboard_show_html", {"html": "<p>x</p>"})
    resp2 = _call(client, "whiteboard_list")
    assert "main" in resp2.json()["result"]["content"][0]["text"]


def test_exec_js_does_not_persist_to_html(client):
    _call(client, "whiteboard_show_html", {"html": "<p>original</p>"})
    resp = _call(client, "whiteboard_exec_js", {"js": "console.log('hi')"})
    assert resp.json()["result"]["isError"] is False

    resp2 = _call(client, "whiteboard_get")
    payload = json.loads(resp2.json()["result"]["content"][0]["text"])
    assert payload["html"] == "<p>original</p>"


def test_point_requires_text_or_selector(client):
    resp = _call(client, "whiteboard_point", {})
    body = resp.json()["result"]
    assert body["isError"] is True


def test_delete_board(client):
    _call(client, "whiteboard_show_html", {"html": "<p>scratch</p>", "id": "scratch"})
    resp = _call(client, "whiteboard_delete", {"id": "scratch"})
    assert resp.json()["result"]["isError"] is False

    resp2 = _call(client, "whiteboard_get", {"id": "scratch"})
    payload = json.loads(resp2.json()["result"]["content"][0]["text"])
    assert "Empty whiteboard" in payload["html"]


def test_unknown_tool_is_error(client):
    resp = _call(client, "not_a_real_tool")
    assert resp.json()["result"]["isError"] is True


def test_load_presentation_501_equivalent_when_unconfigured(client):
    # No presentation_api_base in FakeCtx.config — errors, doesn't crash.
    resp = _call(client, "whiteboard_load_presentation", {"presentation_id": "x"})
    assert resp.json()["result"]["isError"] is True
    assert "presentation API" in resp.json()["result"]["content"][0]["text"]


def test_batched_jsonrpc_requests(client):
    resp = client.post("/mcp", json=[
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
         "params": {"name": "whiteboard_list", "arguments": {}}},
    ])
    assert resp.status_code == 200
    bodies = resp.json()
    assert len(bodies) == 2
    assert bodies[0]["id"] == 1
    assert bodies[1]["id"] == 2


def test_notification_returns_202(client):
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert resp.status_code == 202


# ---- self_register.py -------------------------------------------------------


def test_register_self_writes_mcp_json(tmp_path, monkeypatch):
    monkeypatch.delenv("AW_WORKSPACE_API_KEY", raising=False)
    self_register.register_self(str(tmp_path), 9030)

    data = json.loads((tmp_path / "mcp.json").read_text())
    entry = data["mcpServers"]["whiteboard"]
    assert entry["type"] == "http"
    assert entry["url"].endswith(":9030/api/apps/whiteboard/mcp")
    assert entry["enabled"] is True
    assert "headers" not in entry  # no key available yet


def test_register_self_includes_api_key_header_when_available(tmp_path, monkeypatch):
    monkeypatch.setenv("AW_WORKSPACE_API_KEY", "the-key")
    self_register.register_self(str(tmp_path), 9030)

    data = json.loads((tmp_path / "mcp.json").read_text())
    entry = data["mcpServers"]["whiteboard"]
    assert entry["headers"] == {"X-Api-Key": "the-key"}


def test_register_self_preserves_other_servers_in_existing_mcp_json(tmp_path, monkeypatch):
    monkeypatch.delenv("AW_WORKSPACE_API_KEY", raising=False)
    (tmp_path / "mcp.json").write_text(json.dumps({
        "mcpServers": {"other-app": {"type": "http", "url": "http://x/mcp"}}
    }))

    self_register.register_self(str(tmp_path), 9030)

    data = json.loads((tmp_path / "mcp.json").read_text())
    assert "other-app" in data["mcpServers"]
    assert "whiteboard" in data["mcpServers"]


def test_register_self_is_idempotent_noop_when_unchanged(tmp_path, monkeypatch):
    monkeypatch.setenv("AW_WORKSPACE_API_KEY", "the-key")
    self_register.register_self(str(tmp_path), 9030)
    first_mtime = (tmp_path / "mcp.json").stat().st_mtime_ns

    self_register.register_self(str(tmp_path), 9030)
    second_mtime = (tmp_path / "mcp.json").stat().st_mtime_ns
    assert first_mtime == second_mtime  # no rewrite when entry is unchanged


def test_register_self_noops_when_package_dir_missing(tmp_path):
    missing = tmp_path / "does-not-exist"
    self_register.register_self(str(missing), 9030)
    assert not missing.exists()  # no crash, nothing created
