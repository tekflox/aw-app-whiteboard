"""MCP server for Whiteboard, exposed over Streamable HTTP (POST /mcp).

Ported from agentic-workspace's ``src/mcp/whiteboard-server.py``, which was a
**stdio** MCP server (one child process per client, talking to the legacy
monolith's ``awserv`` over its REST API). This app is a Tier-1 (in-process)
aw-workspace app — the aw-mcp-gateway that aggregates MCP tools runs in a
SIBLING container and cannot spawn a process inside aw-workspace, so the same
tool surface is re-exposed here over Streamable HTTP instead (JSON-RPC 2.0 —
the same wire protocol aw-mcp-gateway's own ``HttpUpstream`` speaks), same
pattern as ``aw-app-kb``'s ``kb_app/mcp_http.py`` + ``main.py``'s ``/mcp``
route.

Unlike the legacy stdio server (which had to round-trip HTTP to awserv) or
this app's own standalone ``mcp_server/server.py`` (a genuinely separate
process, talking X-Api-Key HTTP to a workspace it doesn't share a process
with), this handler calls ``WhiteboardManager``/``WhiteboardBrowser``
DIRECTLY — no HTTP hop needed, it's the same Python process. See
``self_register.py`` for how aw-mcp-gateway discovers this endpoint.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

from fastapi.concurrency import run_in_threadpool

from ..manager import DEFAULT_ID, WhiteboardManager
from ..browser import WhiteboardBrowser


def _screenshot_url(url: str, output_path: str, width: int, height: int,
                    scale: float, full_page: bool, wait_ms: int) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            context = browser.new_context(viewport={"width": width, "height": height},
                                           device_scale_factor=scale)
            page = context.new_page()
            try:
                page.goto(url, wait_until="networkidle", timeout=20000)
            except Exception:
                page.goto(url, wait_until="load", timeout=20000)
            if wait_ms:
                page.wait_for_timeout(wait_ms)
            page.screenshot(path=output_path, full_page=full_page)
        finally:
            browser.close()


TOOLS_SCHEMA = [
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


def _ok(req_id, text):
    return {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "text", "text": text}], "isError": False}}


def _err(req_id, text):
    return {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "text", "text": text}], "isError": True}}


async def _shot_result(board_id: str, path: str, **extra) -> dict:
    try:
        size = os.path.getsize(path)
    except OSError:
        size = 0
    return {"success": True, "board_id": board_id, "path": path, "size_bytes": size, **extra}


def _workspace_api_key_headers() -> dict:
    """``X-Api-Key`` for the outbound presentation-API call — see
    ``routes.py``'s identical helper and
    ``docs/app-workspace-api-auth.md`` in ``aw-app-template``."""
    key = os.environ.get("AW_WORKSPACE_API_KEY")
    return {"X-Api-Key": key} if key else {}


async def handle_request(
    request: dict,
    *,
    mgr: WhiteboardManager,
    browser: WhiteboardBrowser,
    shot_dir: str,
    own_base_url: str,
    presentation_api_base: str | None = None,
) -> dict | None:
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
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS_SCHEMA}}

    if method != "tools/call":
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}}

    name = request.get("params", {}).get("name", "")
    args = request.get("params", {}).get("arguments", {}) or {}
    board_id = args.get("id") or DEFAULT_ID

    if name == "whiteboard_show_html":
        board = mgr.set_html(board_id, args["html"], title=args.get("title"))
        await mgr.broadcast({"type": "whiteboard_update", "action": "set",
                             "board": mgr._to_dict(board, include_html=False)})
        return _ok(req_id, f"Whiteboard '{board_id}' updated ({len(args['html'])} bytes) — viewers reloaded.")

    if name == "whiteboard_get":
        board = mgr.ensure(board_id)
        return _ok(req_id, json.dumps({
            "id": board.id, "title": board.title,
            "source_presentation_id": board.source_presentation_id,
            "html": board.html,
        }, indent=2))

    if name == "whiteboard_list":
        boards = mgr.list_boards()
        items = [f"- {b['id']}: {b.get('title', '')}" for b in boards]
        return _ok(req_id, (f"{len(boards)} whiteboards:\n" + "\n".join(items)) if items else "No whiteboards yet.")

    if name == "whiteboard_delete":
        ok = mgr.delete(board_id)
        if ok:
            await mgr.broadcast({"type": "whiteboard_update", "action": "delete", "id": board_id})
        return _ok(req_id, f"Deleted whiteboard '{board_id}' (recreates blank on next access).")

    if name == "whiteboard_exec_js":
        mgr.exec_js(board_id, args["js"])
        await mgr.broadcast({"type": "whiteboard_exec", "action": "exec_js", "id": board_id, "js": args["js"]})
        return _ok(req_id, f"Ran JS on whiteboard '{board_id}' (live, not persisted).")

    if name == "whiteboard_point":
        if not args.get("text") and not args.get("selector"):
            return _err(req_id, "Provide 'text' or 'selector' to point at.")
        msg = mgr.point(board_id, selector=args.get("selector"), text=args.get("text"),
                        scroll=args.get("scroll", True), highlight=args.get("highlight", True),
                        duration=int(args.get("duration") or 4000), color=args.get("color"))
        await mgr.broadcast(msg)
        tgt = args.get("text") or args.get("selector")
        return _ok(req_id, f"Pointed at '{tgt}' on whiteboard '{board_id}'.")

    if name == "whiteboard_close":
        msg = mgr.close_view(board_id)
        await mgr.broadcast(msg)
        return _ok(req_id, f"Closed whiteboard '{board_id}' window on all viewers.")

    if name == "whiteboard_status":
        status = mgr.status(board_id)
        return _ok(req_id, json.dumps(status, indent=2, ensure_ascii=False))

    if name == "whiteboard_screenshot":
        board = mgr.get(board_id)
        if not board:
            return _err(req_id, f"whiteboard '{board_id}' not found")
        os.makedirs(shot_dir, exist_ok=True)
        out = os.path.join(shot_dir, f"{board_id}-{int(time.time())}.png")
        full_page = bool(args.get("full_page", True))
        width = int(args.get("width") or 1280)
        height = int(args.get("height") or 800)
        wait_ms = int(args.get("wait_ms") or 900)
        html_url = f"{own_base_url}/api/apps/whiteboard/boards/{board_id}/html"
        try:
            await run_in_threadpool(_screenshot_url, html_url, out, width, height, 2.0, full_page, wait_ms)
        except Exception as exc:
            return _err(req_id, f"screenshot failed: {exc}")
        size = os.path.getsize(out) if os.path.exists(out) else 0
        return _ok(req_id, f"Screenshot saved: {out} ({size} bytes). Read the path to view it.")

    if name in ("whiteboard_browse", "whiteboard_click", "whiteboard_type",
                "whiteboard_key", "whiteboard_scroll", "whiteboard_eval"):
        try:
            if name == "whiteboard_browse":
                path = await browser.browse(board_id, args.get("url") or f"{own_base_url}/api/apps/whiteboard/boards/{board_id}/html")
                result = await _shot_result(board_id, path, url=args.get("url"))
            elif name == "whiteboard_click":
                if "x" not in args or "y" not in args:
                    return _err(req_id, "x and y are required")
                path = await browser.click(board_id, float(args["x"]), float(args["y"]), double=bool(args.get("double", False)))
                result = await _shot_result(board_id, path)
            elif name == "whiteboard_type":
                if "text" not in args:
                    return _err(req_id, "text is required")
                path = await browser.type_text(board_id, str(args["text"]), submit=bool(args.get("submit", False)))
                result = await _shot_result(board_id, path)
            elif name == "whiteboard_key":
                if "key" not in args:
                    return _err(req_id, "key is required")
                path = await browser.press(board_id, str(args["key"]))
                result = await _shot_result(board_id, path)
            elif name == "whiteboard_scroll":
                path = await browser.scroll(board_id, int(args.get("dy") or 400), dx=int(args.get("dx") or 0))
                result = await _shot_result(board_id, path)
            else:  # whiteboard_eval
                if "js" not in args:
                    return _err(req_id, "js is required")
                eval_result, path = await browser.eval_js(board_id, str(args["js"]))
                try:
                    json.dumps(eval_result)
                except (TypeError, ValueError):
                    eval_result = str(eval_result)
                result = await _shot_result(board_id, path, result=eval_result)
        except Exception as exc:
            return _err(req_id, f"Error: {exc}")
        extra = ""
        if "result" in result:
            extra = f"\nresult: {json.dumps(result['result'], ensure_ascii=False)}"
        if result.get("url"):
            extra += f"\nurl: {result['url']}"
        return _ok(req_id, f"Screenshot: {result.get('path')} ({result.get('size_bytes', 0)} bytes). Read the path to see the result.{extra}")

    if name == "whiteboard_browser_close":
        closed = await browser.close(board_id)
        return _ok(req_id, f"Browser session closed for '{board_id}'." if closed else "No browser session was open.")

    if name == "whiteboard_load_presentation":
        if not presentation_api_base:
            return _err(req_id, "no presentation API configured for this workspace (presentation_api_base unset)")
        pid = args.get("presentation_id")
        if not pid:
            return _err(req_id, "presentation_id is required")
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{presentation_api_base}/api/presentation/{pid}", headers=_workspace_api_key_headers())
        if resp.status_code != 200:
            return _err(req_id, f"presentation '{pid}' not found")
        pres = resp.json()
        mgr.set_html(board_id, pres["html"], title=pres.get("title"), source_presentation_id=pid)
        board = mgr.get(board_id)
        await mgr.broadcast({"type": "whiteboard_update", "action": "set",
                             "board": mgr._to_dict(board, include_html=False)})
        return _ok(req_id, f"Loaded presentation '{pid}' into whiteboard '{board_id}'.")

    if name == "whiteboard_save_presentation":
        if not presentation_api_base:
            return _err(req_id, "no presentation API configured for this workspace (presentation_api_base unset)")
        board = mgr.get(board_id)
        if not board:
            return _err(req_id, f"whiteboard '{board_id}' not found")
        pid = args.get("presentation_id") or board.source_presentation_id
        if not pid:
            return _err(req_id, "no presentation_id and this whiteboard has no linked presentation")
        title = args.get("title") or board.title
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.put(f"{presentation_api_base}/api/presentation/{pid}",
                                    json={"title": title, "html": board.html},
                                    headers=_workspace_api_key_headers())
        if resp.status_code >= 400:
            return _err(req_id, "presentation save failed")
        mgr.set_html(board_id, board.html, source_presentation_id=pid)
        return _ok(req_id, f"Whiteboard '{board_id}' saved presentation '{pid}'.")

    return _err(req_id, f"Unknown tool: {name}")
