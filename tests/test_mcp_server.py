"""Unit tests for mcp_server/server.py — the standalone whiteboard MCP that
talks to a running aw-workspace's /api/apps/whiteboard/* routes over HTTP,
authenticating with the workspace-wide X-Api-Key header.

httpx.request is monkeypatched (module-level function) so no real network
call happens — each test asserts on the constructed request (method, URL,
headers, body) and/or the JSON-RPC response shape.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from mcp_server import server as mcp  # noqa: E402


class _FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.delenv(mcp.ENV_VAR_NAME, raising=False)
    monkeypatch.delenv("AW_WORKSPACE_ENV_FILE", raising=False)
    monkeypatch.delenv("AW_WORKSPACE_API_URL", raising=False)


@pytest.fixture
def fake_request(monkeypatch):
    calls = []

    def _fake(method, url, json=None, headers=None, timeout=None):
        calls.append({"method": method, "url": url, "json": json, "headers": headers or {}})
        return _FakeResponse(200, {"success": True, "id": "main", "title": "Hi", "html": "<p>hi</p>"})

    monkeypatch.setattr(mcp.httpx, "request", _fake)
    return calls


def _call(name, arguments=None):
    return mcp.handle_request({
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": name, "arguments": arguments or {}},
    })


def test_sends_x_api_key_header_when_env_var_set(fake_request, monkeypatch):
    monkeypatch.setenv(mcp.ENV_VAR_NAME, "the-key")
    _call("whiteboard_list")
    assert fake_request[-1]["headers"].get(mcp.HEADER_NAME) == "the-key"


def test_no_header_when_no_key_available_anywhere(fake_request, monkeypatch, tmp_path):
    # Point AW_WORKSPACE_ENV_FILE at a path that doesn't exist, so this
    # doesn't accidentally pick up a real ~/.aw-workspace/.env on whatever
    # machine runs the test.
    monkeypatch.setenv("AW_WORKSPACE_ENV_FILE", str(tmp_path / "no-such-file" / ".env"))
    _call("whiteboard_list")
    assert mcp.HEADER_NAME not in fake_request[-1]["headers"]


def test_env_var_takes_precedence_over_env_file(fake_request, monkeypatch, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(f"{mcp.ENV_VAR_NAME}=from-file\n")
    monkeypatch.setenv("AW_WORKSPACE_ENV_FILE", str(env_file))
    monkeypatch.setenv(mcp.ENV_VAR_NAME, "from-env-var")

    _call("whiteboard_list")
    assert fake_request[-1]["headers"][mcp.HEADER_NAME] == "from-env-var"


def test_falls_back_to_env_file_when_env_var_unset(fake_request, monkeypatch, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(f"SOME_OTHER_VAR=x\n{mcp.ENV_VAR_NAME}=from-file\n")
    monkeypatch.setenv("AW_WORKSPACE_ENV_FILE", str(env_file))

    _call("whiteboard_list")
    assert fake_request[-1]["headers"][mcp.HEADER_NAME] == "from-file"


def test_whiteboard_show_html_puts_to_correct_url(fake_request, monkeypatch):
    monkeypatch.setenv("AW_WORKSPACE_API_URL", "http://example:9030")
    result = _call("whiteboard_show_html", {"html": "<h1>Hi</h1>", "id": "scratch", "title": "T"})

    call = fake_request[-1]
    assert call["method"] == "PUT"
    assert call["url"] == "http://example:9030/api/apps/whiteboard/boards/scratch"
    assert call["json"] == {"html": "<h1>Hi</h1>", "title": "T"}
    assert result["result"]["isError"] is False


def test_whiteboard_get_uses_default_board_id(fake_request):
    _call("whiteboard_get")
    call = fake_request[-1]
    assert call["method"] == "GET"
    assert call["url"].endswith("/boards/main")


def test_whiteboard_exec_js_posts_js_body(fake_request):
    _call("whiteboard_exec_js", {"js": "alert(1)", "id": "main"})
    call = fake_request[-1]
    assert call["method"] == "POST"
    assert call["url"].endswith("/boards/main/exec")
    assert call["json"] == {"js": "alert(1)"}


def test_whiteboard_point_requires_text_or_selector():
    result = _call("whiteboard_point", {})
    assert result["result"]["isError"] is True
    assert "text" in result["result"]["content"][0]["text"] or "selector" in result["result"]["content"][0]["text"]


def test_error_response_surfaces_backend_error(monkeypatch):
    def _fake(method, url, json=None, headers=None, timeout=None):
        return _FakeResponse(404, {"detail": "whiteboard 'x' not found"})

    monkeypatch.setattr(mcp.httpx, "request", _fake)
    result = _call("whiteboard_get", {"id": "x"})
    assert result["result"]["isError"] is True
    assert "not found" in result["result"]["content"][0]["text"]


def test_tools_list_includes_all_expected_tools():
    result = mcp.handle_request({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    names = {t["name"] for t in result["result"]["tools"]}
    assert "whiteboard_show_html" in names
    assert "whiteboard_load_presentation" in names
    assert "whiteboard_browser_close" in names
    assert len(names) == len(mcp._TOOLS)  # no duplicate tool names


def test_initialize_returns_server_info():
    result = mcp.handle_request({"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert result["result"]["serverInfo"]["name"] == "aw-app-whiteboard"


def test_unknown_tool_is_an_error():
    result = _call("not_a_real_tool")
    assert result["result"]["isError"] is True
    assert "Unknown tool" in result["result"]["content"][0]["text"]
