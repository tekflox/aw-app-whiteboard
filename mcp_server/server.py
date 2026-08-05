"""Stdio MCP server for the decoupled aw-app-whiteboard app.

Talks to a running aw-workspace's OWN routes at
``/api/apps/whiteboard/*`` (see ``whiteboard_app/routes.py``) over plain
HTTP, authenticating with the workspace-wide ``X-Api-Key`` header instead
of a browser-issued identity JWT — see aw-workspace's
``src/api/workspace_api_key.py`` and
``docs/app-workspace-api-auth.md`` in the ``aw-app-template`` repo for the
general pattern every decoupled app/MCP can reuse.

This is a STANDALONE process, separate from aw-workspace itself (unlike the
in-process Tier-1 whiteboard_app plugin) — it can run anywhere that can
reach the workspace's API host (same machine, another container, a
developer's laptop) as long as it has the two env vars below.

Environment:
    AW_WORKSPACE_API_URL   Base URL of the aw-workspace API
                           (default "http://127.0.0.1:9030").
    AW_WORKSPACE_API_KEY   The workspace's shared API key. Read fresh on
                           EVERY call (not cached at import time) so a
                           regenerated key takes effect without restarting
                           this process — checked in this order:
                             1. the AW_WORKSPACE_API_KEY environment
                                variable (explicit override), then
                             2. AW_WORKSPACE_ENV_FILE, or
                                ~/.aw-workspace/.env if unset — the same
                                file aw-workspace's own
                                get_or_create_workspace_api_key() /
                                regenerate_workspace_api_key() write to on
                                every mint/rotate.

Run (stdio):
    AW_WORKSPACE_API_URL=http://127.0.0.1:9030 python -m mcp_server.server
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

DEFAULT_API_URL = "http://127.0.0.1:9030"
DEFAULT_ID = "main"
ENV_VAR_NAME = "AW_WORKSPACE_API_KEY"
HEADER_NAME = "X-Api-Key"


def _api_url() -> str:
    return os.environ.get("AW_WORKSPACE_API_URL", DEFAULT_API_URL).rstrip("/")


def _default_env_file() -> str:
    return str(Path.home() / ".aw-workspace" / ".env")


def _read_key_from_env_file() -> str | None:
    path = os.environ.get("AW_WORKSPACE_ENV_FILE") or _default_env_file()
    prefix = f"{ENV_VAR_NAME}="
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(prefix):
                    return line[len(prefix):].strip() or None
    except FileNotFoundError:
        return None
    return None


def _get_api_key() -> str | None:
    """Read the key fresh on every call — explicit env var wins, otherwise
    the .env file aw-workspace writes to on every generate/regenerate."""
    return os.environ.get(ENV_VAR_NAME) or _read_key_from_env_file()


def _api(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{_api_url()}/api/apps/whiteboard{path}"
    headers = {}
    api_key = _get_api_key()
    if api_key:
        headers[HEADER_NAME] = api_key
    try:
        resp = httpx.request(method, url, json=body, headers=headers, timeout=15)
    except httpx.HTTPError as e:
        return {"error": str(e), "success": False}
    try:
        data = resp.json()
    except ValueError:
        return {"error": f"HTTP {resp.status_code}: non-JSON response", "success": False}
    if resp.status_code >= 400 and "error" not in data and "detail" not in data:
        data = {**data, "error": f"HTTP {resp.status_code}", "success": False}
    return data


_TOOLS = [
    {
        "name": "whiteboard_show_html",
        "description": (
            "Set (replace) the whole whiteboard canvas with new HTML. Every open "
            "viewer reloads instantly. The board is identified by `id` (default "
            "'main') and survives across sessions and devices."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "html": {"type": "string", "description": "Full HTML document to render (inline CSS/JS ok)."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
                "title": {"type": "string", "description": "Optional title for the board."},
            },
            "required": ["html"],
        },
    },
    {
        "name": "whiteboard_get",
        "description": "Get a whiteboard's current HTML and metadata (title, linked presentation).",
        "inputSchema": {
            "type": "object",
            "properties": {"id": {"type": "string", "description": "Whiteboard id. Default 'main'."}},
        },
    },
    {
        "name": "whiteboard_list",
        "description": "List all persistent whiteboards on this workspace.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "whiteboard_delete",
        "description": "Delete a whiteboard's content (it re-creates blank on next access — doesn't 404).",
        "inputSchema": {
            "type": "object",
            "properties": {"id": {"type": "string", "description": "Whiteboard id. Default 'main'."}},
        },
    },
    {
        "name": "whiteboard_exec_js",
        "description": (
            "Run JavaScript inside every open whiteboard viewer WITHOUT reloading — "
            "for incremental edits on the live canvas. NOT persisted into the board "
            "HTML; use whiteboard_show_html to persist structural content."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "js": {"type": "string", "description": "JavaScript source to execute in the live viewer(s)."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
            },
            "required": ["js"],
        },
    },
    {
        "name": "whiteboard_point",
        "description": (
            "Point at / highlight an element on the live whiteboard — scroll it into "
            "view and flash a temporary glowing pulse around it. Target by CSS "
            "`selector` or by visible `text`."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Visible text to find the element by."},
                "selector": {"type": "string", "description": "CSS selector for the target element."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
                "highlight": {"type": "boolean", "description": "Flash the pulsing highlight. Default true."},
                "scroll": {"type": "boolean", "description": "Scroll the element into view. Default true."},
                "duration": {"type": "integer", "description": "Highlight duration in ms. Default 4000."},
                "color": {"type": "string", "description": "Highlight color as hex. Default red."},
            },
        },
    },
    {
        "name": "whiteboard_close",
        "description": "Close the whiteboard window/screen on every viewer. Board content is kept.",
        "inputSchema": {
            "type": "object",
            "properties": {"id": {"type": "string", "description": "Whiteboard id. Default 'main'."}},
        },
    },
    {
        "name": "whiteboard_status",
        "description": (
            "See what is currently on the whiteboard and what the viewer is looking "
            "at: loaded board title + source presentation, section outline, viewer "
            "count, and live scroll position."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"id": {"type": "string", "description": "Whiteboard id. Default 'main'."}},
        },
    },
    {
        "name": "whiteboard_screenshot",
        "description": (
            "Take a real headless-browser screenshot of the whiteboard's current "
            "content (captures live embedded content, not just static HTML) and "
            "return the PNG file path."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
                "full_page": {"type": "boolean", "description": "Whole scrollable board vs viewport only."},
                "width": {"type": "integer", "description": "Viewport width in CSS px. Default 1280."},
                "height": {"type": "integer", "description": "Viewport height in CSS px. Default 800."},
                "wait_ms": {"type": "integer", "description": "Extra wait for dynamic content. Default 900."},
            },
        },
    },
    {
        "name": "whiteboard_browse",
        "description": (
            "Open the agent-piloted browser inside the whiteboard on a URL (or the "
            "board's own content if no url). Returns a screenshot path."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to load. Omit to (re)load the board content."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
            },
        },
    },
    {
        "name": "whiteboard_click",
        "description": "Click at (x, y) CSS-pixel coordinates in the piloted browser. Returns a screenshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x": {"type": "number", "description": "X coordinate."},
                "y": {"type": "number", "description": "Y coordinate."},
                "double": {"type": "boolean", "description": "Double-click. Default false."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
            },
            "required": ["x", "y"],
        },
    },
    {
        "name": "whiteboard_type",
        "description": "Type text into the piloted browser's focused field. Returns a screenshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text to type."},
                "submit": {"type": "boolean", "description": "Press Enter after typing. Default false."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
            },
            "required": ["text"],
        },
    },
    {
        "name": "whiteboard_key",
        "description": "Press a key in the piloted browser (Playwright syntax, e.g. 'Enter'). Returns a screenshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "key": {"type": "string", "description": "Key name."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
            },
            "required": ["key"],
        },
    },
    {
        "name": "whiteboard_scroll",
        "description": "Scroll the piloted browser by dy pixels. Returns a screenshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dy": {"type": "integer", "description": "Vertical scroll in px. Default 400."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
            },
        },
    },
    {
        "name": "whiteboard_eval",
        "description": "Run JavaScript in the piloted browser page and return its result plus a screenshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "js": {"type": "string", "description": "JavaScript expression or function to evaluate."},
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
            },
            "required": ["js"],
        },
    },
    {
        "name": "whiteboard_browser_close",
        "description": "Close the piloted browser session for a board (frees the headless chromium process).",
        "inputSchema": {
            "type": "object",
            "properties": {"id": {"type": "string", "description": "Whiteboard id. Default 'main'."}},
        },
    },
    {
        "name": "whiteboard_load_presentation",
        "description": (
            "Load an existing presentation's HTML into the whiteboard. Requires "
            "presentation_api_base configured in this app's config_schema — 501s "
            "otherwise."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "presentation_id": {"type": "string", "description": "Presentation to load in."},
                "id": {"type": "string", "description": "Target whiteboard id. Default 'main'."},
            },
            "required": ["presentation_id"],
        },
    },
    {
        "name": "whiteboard_save_presentation",
        "description": (
            "Save the whiteboard's current HTML back to a presentation. Requires "
            "presentation_api_base configured — 501s otherwise."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Whiteboard id. Default 'main'."},
                "presentation_id": {"type": "string", "description": "Target presentation (omit to use the linked source)."},
                "title": {"type": "string", "description": "Optional presentation title."},
            },
        },
    },
]


def handle_request(request: dict) -> dict | None:
    method = request.get("method", "")
    req_id = request.get("id")

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "aw-app-whiteboard", "version": "1.0.0"},
            },
        }
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": _TOOLS}}

    if method == "tools/call":
        name = request.get("params", {}).get("name", "")
        args = request.get("params", {}).get("arguments", {}) or {}
        board_id = args.get("id") or DEFAULT_ID

        if name == "whiteboard_show_html":
            body = {"html": args["html"]}
            if args.get("title"):
                body["title"] = args["title"]
            r = _api("PUT", f"/boards/{board_id}", body)
            if r.get("success"):
                return _ok(req_id, f"Whiteboard '{board_id}' updated ({len(args['html'])} bytes) — viewers reloaded.")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_get":
            r = _api("GET", f"/boards/{board_id}")
            if r.get("id"):
                return _ok(req_id, json.dumps({
                    "id": r["id"], "title": r.get("title"),
                    "source_presentation_id": r.get("source_presentation_id"),
                    "html": r.get("html"),
                }, indent=2))
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_list":
            r = _api("GET", "/boards")
            if isinstance(r, list):
                items = [f"- {b['id']}: {b.get('title', '')}" for b in r]
                return _ok(req_id, (f"{len(r)} whiteboards:\n" + "\n".join(items)) if items else "No whiteboards yet.")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'failed to list whiteboards')}")

        if name == "whiteboard_delete":
            r = _api("DELETE", f"/boards/{board_id}")
            if r.get("success"):
                return _ok(req_id, f"Deleted whiteboard '{board_id}' (recreates blank on next access).")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_exec_js":
            r = _api("POST", f"/boards/{board_id}/exec", {"js": args["js"]})
            if r.get("success"):
                return _ok(req_id, f"Ran JS on whiteboard '{board_id}' (live, not persisted).")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_point":
            if not args.get("text") and not args.get("selector"):
                return _err(req_id, "Provide 'text' or 'selector' to point at.")
            body = {k: args[k] for k in ("text", "selector", "highlight", "scroll", "duration", "color") if k in args}
            r = _api("POST", f"/boards/{board_id}/point", body)
            if r.get("success"):
                tgt = args.get("text") or args.get("selector")
                return _ok(req_id, f"Pointed at '{tgt}' on whiteboard '{board_id}'.")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_close":
            r = _api("POST", f"/boards/{board_id}/close", {})
            if r.get("success"):
                return _ok(req_id, f"Closed whiteboard '{board_id}' window on all viewers.")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_status":
            r = _api("GET", f"/boards/{board_id}/status")
            if r.get("id"):
                return _ok(req_id, json.dumps(r, indent=2, ensure_ascii=False))
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_screenshot":
            body = {k: args[k] for k in ("full_page", "width", "height", "wait_ms") if k in args}
            r = _api("POST", f"/boards/{board_id}/screenshot", body)
            if r.get("success"):
                return _ok(req_id, f"Screenshot saved: {r.get('path')} ({r.get('size_bytes', 0)} bytes). Read the path to view it.")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name in ("whiteboard_browse", "whiteboard_click", "whiteboard_type",
                    "whiteboard_key", "whiteboard_scroll", "whiteboard_eval"):
            ep = name.replace("whiteboard_", "")
            body = {k: v for k, v in args.items() if k != "id"}
            r = _api("POST", f"/boards/{board_id}/{ep}", body)
            if r.get("success"):
                extra = ""
                if "result" in r:
                    extra = f"\nresult: {json.dumps(r['result'], ensure_ascii=False)}"
                if r.get("url"):
                    extra += f"\nurl: {r['url']}"
                return _ok(req_id, f"Screenshot: {r.get('path')} ({r.get('size_bytes', 0)} bytes). Read the path to see the result.{extra}")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_browser_close":
            r = _api("POST", f"/boards/{board_id}/browser_close", {})
            return _ok(req_id, f"Browser session closed for '{board_id}'." if r.get("success") else "No browser session was open.")

        if name == "whiteboard_load_presentation":
            r = _api("POST", f"/boards/{board_id}/load_presentation", {"presentation_id": args["presentation_id"]})
            if r.get("success"):
                return _ok(req_id, f"Loaded presentation '{args['presentation_id']}' into whiteboard '{board_id}'.")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        if name == "whiteboard_save_presentation":
            body = {k: args[k] for k in ("presentation_id", "title") if args.get(k)}
            r = _api("POST", f"/boards/{board_id}/save_presentation", body)
            if r.get("success"):
                return _ok(req_id, f"Whiteboard '{board_id}' {r.get('action')} presentation '{r.get('presentation_id')}'.")
            return _err(req_id, f"Error: {r.get('detail') or r.get('error', 'unknown')}")

        return _err(req_id, f"Unknown tool: {name}")

    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}}


def _ok(req_id, text):
    return {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "text", "text": text}], "isError": False}}


def _err(req_id, text):
    return {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "text", "text": text}], "isError": True}}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue
        response = handle_request(request)
        if response is not None:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
