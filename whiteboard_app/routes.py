"""Whiteboard REST + WebSocket endpoints, ported from the monolith's
``src/api/routes/whiteboard.py`` onto this app's own FastAPI sub-app
(mounted at ``/api/apps/whiteboard`` via ``ctx.routes.register`` —
``routes:register`` already covers WebSocket routes, a Starlette ``Mount``
forwards ``websocket`` scopes same as ``http``).

Endpoint paths are namespaced under this app's own prefix (the monolith's
``/api/whiteboards/*`` + ``/ws/whiteboard`` become
``/api/apps/whiteboard/boards/*`` + ``/api/apps/whiteboard/ws``), everything
else — request/response shapes, behavior — is a faithful port.

NOT ported (see the migration report / Kanban comment for why):
* Presentation load/save round-trip — best-effort against an HTTP
  presentation API the target workspace may not have (aw-workspace does not
  ship one yet); degrades to a clear 501 instead of crashing.
* Ninja/notification integration — the monolith has none for whiteboard
  either, nothing to port.
"""

from __future__ import annotations

import json
import logging
import os
import time

from fastapi import Body, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse

from .browser import WhiteboardBrowser
from .manager import DEFAULT_ID, WhiteboardManager
from .viewer import VIEWER_SHELL

_log = logging.getLogger("whiteboard_app.routes")


def _screenshot_url(url: str, output_path: str, width: int, height: int,
                    scale: float, full_page: bool, wait_ms: int) -> None:
    """Synchronous headless-chromium screenshot, run in a worker thread."""
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


def build_routes(ctx, mgr: WhiteboardManager, browser: WhiteboardBrowser,
                 shot_dir: str, own_base_url: str) -> FastAPI:
    api = FastAPI()

    def _own_html_url(board_id: str) -> str:
        return f"{own_base_url}/api/apps/whiteboard/boards/{board_id}/html"

    @api.get("/boards")
    async def list_boards():
        return mgr.list_boards()

    @api.get("/boards/{board_id}")
    async def get_board(board_id: str):
        board = mgr.ensure(board_id)
        return mgr._to_dict(board)

    @api.get("/boards/{board_id}/html")
    async def get_board_html(board_id: str):
        board = mgr.ensure(board_id)
        return HTMLResponse(content=board.html)

    @api.get("/boards/{board_id}/status")
    async def status(board_id: str):
        return mgr.status(board_id)

    @api.get("/view/{board_id}")
    async def view_board(board_id: str):
        """Live viewer shell — embeds the board in an iframe, subscribes to
        ``/api/apps/whiteboard/ws`` so it reloads on `set` / runs injected JS
        on `exec_js`, no manual refresh, on any device."""
        return HTMLResponse(content=VIEWER_SHELL.replace("__BOARD_ID__", board_id))

    @api.put("/boards/{board_id}")
    async def set_board(board_id: str, data: dict = Body(...)):
        html = data.get("html")
        if html is None:
            raise HTTPException(status_code=400, detail="html is required")
        board = mgr.set_html(board_id, html, title=data.get("title"),
                             source_presentation_id=data.get("source_presentation_id"))
        await mgr.broadcast({"type": "whiteboard_update", "action": "set",
                             "board": mgr._to_dict(board, include_html=False)})
        return {**mgr._to_dict(board, include_html=False), "success": True}

    @api.delete("/boards/{board_id}")
    async def delete_board(board_id: str):
        ok = mgr.delete(board_id)
        if ok:
            await mgr.broadcast({"type": "whiteboard_update", "action": "delete", "id": board_id})
        return {"success": ok}

    @api.post("/boards/{board_id}/exec")
    async def exec_js(board_id: str, data: dict = Body(...)):
        js = data.get("js")
        if not js:
            raise HTTPException(status_code=400, detail="js is required")
        mgr.exec_js(board_id, js)
        await mgr.broadcast({"type": "whiteboard_exec", "action": "exec_js", "id": board_id, "js": js})
        return {"success": True}

    @api.post("/boards/{board_id}/point")
    async def point(board_id: str, data: dict = Body(...)):
        selector = data.get("selector")
        text = data.get("text")
        if not selector and not text:
            raise HTTPException(status_code=400, detail="selector or text is required")
        msg = mgr.point(board_id, selector=selector, text=text,
                        scroll=data.get("scroll", True), highlight=data.get("highlight", True),
                        duration=int(data.get("duration") or 4000), color=data.get("color"))
        await mgr.broadcast(msg)
        return {"success": True}

    @api.post("/boards/{board_id}/close")
    async def close_view(board_id: str, data: dict = Body(default={})):
        msg = mgr.close_view(board_id)
        await mgr.broadcast(msg)
        return {"success": True}

    @api.post("/boards/{board_id}/screenshot")
    async def screenshot(board_id: str, data: dict = Body(default={})):
        board = mgr.get(board_id)
        if not board:
            raise HTTPException(status_code=404, detail=f"whiteboard '{board_id}' not found")
        os.makedirs(shot_dir, exist_ok=True)
        out = (data or {}).get("output_path") or os.path.join(shot_dir, f"{board_id}-{int(time.time())}.png")
        full_page = bool((data or {}).get("full_page", True))
        width = int((data or {}).get("width") or 1280)
        height = int((data or {}).get("height") or 800)
        wait_ms = int((data or {}).get("wait_ms") or 900)
        try:
            await run_in_threadpool(_screenshot_url, _own_html_url(board_id), out, width, height,
                                    2.0, full_page, wait_ms)
        except Exception as exc:
            _log.exception("whiteboard screenshot failed for %s", board_id)
            raise HTTPException(status_code=500, detail=f"screenshot failed: {exc}") from exc
        return {"success": True, "board_id": board_id, "path": out,
                "size_bytes": os.path.getsize(out), "title": board.title}

    async def _shot_result(board_id: str, path: str, **extra) -> dict:
        try:
            size = os.path.getsize(path)
        except OSError:
            size = 0
        return {"success": True, "board_id": board_id, "path": path, "size_bytes": size, **extra}

    @api.post("/boards/{board_id}/browse")
    async def browse(board_id: str, data: dict = Body(default={})):
        url = (data or {}).get("url") or _own_html_url(board_id)
        path = await browser.browse(board_id, url)
        return await _shot_result(board_id, path, url=url)

    @api.post("/boards/{board_id}/click")
    async def click(board_id: str, data: dict = Body(...)):
        if "x" not in data or "y" not in data:
            raise HTTPException(status_code=400, detail="x and y are required")
        path = await browser.click(board_id, float(data["x"]), float(data["y"]),
                                   double=bool(data.get("double", False)))
        return await _shot_result(board_id, path)

    @api.post("/boards/{board_id}/type")
    async def type_text(board_id: str, data: dict = Body(...)):
        if "text" not in data:
            raise HTTPException(status_code=400, detail="text is required")
        path = await browser.type_text(board_id, str(data["text"]), submit=bool(data.get("submit", False)))
        return await _shot_result(board_id, path)

    @api.post("/boards/{board_id}/key")
    async def press_key(board_id: str, data: dict = Body(...)):
        if "key" not in data:
            raise HTTPException(status_code=400, detail="key is required")
        path = await browser.press(board_id, str(data["key"]))
        return await _shot_result(board_id, path)

    @api.post("/boards/{board_id}/scroll")
    async def scroll(board_id: str, data: dict = Body(default={})):
        path = await browser.scroll(board_id, int((data or {}).get("dy") or 400),
                                    dx=int((data or {}).get("dx") or 0))
        return await _shot_result(board_id, path)

    @api.post("/boards/{board_id}/eval")
    async def eval_js(board_id: str, data: dict = Body(...)):
        if "js" not in data:
            raise HTTPException(status_code=400, detail="js is required")
        result, path = await browser.eval_js(board_id, str(data["js"]))
        try:
            json.dumps(result)
        except (TypeError, ValueError):
            result = str(result)
        return await _shot_result(board_id, path, result=result)

    @api.post("/boards/{board_id}/browser_close")
    async def browser_close(board_id: str, data: dict = Body(default={})):
        return {"success": await browser.close(board_id)}

    # ------------------------------------------------------------------
    # Presentation round-trip — best-effort, degrades cleanly.
    #
    # The monolith imports its in-process `presentation_mgr` directly; an app
    # cannot (apps don't import core internals — routes:register is the only
    # sanctioned surface). aw-workspace does not expose a presentation API
    # yet (confirmed absent per the F6 ADR's own investigation), so these two
    # endpoints degrade to 501 instead of silently no-op'ing or crashing.
    # Wire `presentation_api_base` in config_schema once one exists.
    # ------------------------------------------------------------------

    def _presentation_base() -> str | None:
        return (ctx.config or {}).get("presentation_api_base")

    def _workspace_api_key_headers() -> dict:
        """``X-Api-Key`` for the outbound presentation-API call, read straight
        from the environment (``AW_WORKSPACE_API_KEY``, set by aw-workspace's
        ``src.api.workspace_api_key`` on every generate/regenerate) — no
        ``config_schema`` field needed, nothing for a human to configure.
        Empty dict if unset (older workspace without the key yet)."""
        key = os.environ.get("AW_WORKSPACE_API_KEY")
        return {"X-Api-Key": key} if key else {}

    @api.post("/boards/{board_id}/load_presentation")
    async def load_presentation(board_id: str, data: dict = Body(...)):
        base = _presentation_base()
        if not base:
            raise HTTPException(
                status_code=501,
                detail="no presentation API configured for this workspace (presentation_api_base unset)",
            )
        pid = data.get("presentation_id")
        if not pid:
            raise HTTPException(status_code=400, detail="presentation_id is required")
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{base}/api/presentation/{pid}", headers=_workspace_api_key_headers())
        if resp.status_code != 200:
            raise HTTPException(status_code=404, detail=f"presentation '{pid}' not found")
        pres = resp.json()
        board = mgr.set_html(board_id, pres["html"], title=pres.get("title"), source_presentation_id=pid)
        await mgr.broadcast({"type": "whiteboard_update", "action": "set",
                             "board": mgr._to_dict(board, include_html=False)})
        return {**mgr._to_dict(board, include_html=False), "loaded_from": pid, "success": True}

    @api.post("/boards/{board_id}/save_presentation")
    async def save_presentation(board_id: str, data: dict = Body(default={})):
        base = _presentation_base()
        if not base:
            raise HTTPException(
                status_code=501,
                detail="no presentation API configured for this workspace (presentation_api_base unset)",
            )
        board = mgr.get(board_id)
        if not board:
            raise HTTPException(status_code=404, detail=f"whiteboard '{board_id}' not found")
        pid = (data or {}).get("presentation_id") or board.source_presentation_id
        if not pid:
            raise HTTPException(status_code=400,
                                detail="no presentation_id and this whiteboard has no linked presentation")
        title = (data or {}).get("title") or board.title
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.put(f"{base}/api/presentation/{pid}",
                                    json={"title": title, "html": board.html},
                                    headers=_workspace_api_key_headers())
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail="presentation save failed")
        mgr.set_html(board_id, board.html, source_presentation_id=pid)
        return {"success": True, "presentation_id": pid, "action": "saved"}

    # ------------------------------------------------------------------
    # MCP — Streamable HTTP, auto-discovered by aw-mcp-gateway's app-scan
    # (see mcp/self_register.py + mcp/http_handler.py). Guarded by the same
    # IdentityGuard every other route here is (X-Api-Key or an identity JWT
    # both work — see docs/app-workspace-api-auth.md in aw-app-template).
    # ------------------------------------------------------------------

    @api.post("/mcp")
    async def mcp_post(data: dict | list = Body(...)):
        from fastapi.responses import JSONResponse, Response

        from .mcp.http_handler import handle_request as mcp_handle_request

        messages = data if isinstance(data, list) else [data]
        responses = []
        for m in messages:
            r = await mcp_handle_request(
                m, mgr=mgr, browser=browser, shot_dir=shot_dir,
                own_base_url=own_base_url, presentation_api_base=_presentation_base(),
            )
            if r is not None:
                responses.append(r)
        if not responses:
            return Response(status_code=202)
        return JSONResponse(responses if isinstance(data, list) else responses[0])

    @api.get("/mcp")
    async def mcp_get():
        from fastapi.responses import Response
        return Response(status_code=405)

    # ------------------------------------------------------------------
    # WebSocket — live sync
    # ------------------------------------------------------------------

    @api.websocket("/ws")
    async def whiteboard_stream(websocket: WebSocket):
        """Stream whiteboard set/exec/point/delete events to viewers.

        NOTE (F6 gap, applies to every app, not whiteboard-specific): this
        route is mounted unauthenticated today — the ``IdentityGuard`` ASGI
        wrapper the F6 ADR proposes for ``AppRuntime._mount`` (HTTP + WS) has
        not landed. Tracked by the framework capability this app is blocked
        on (see the migration report); not re-solved here.
        """
        await websocket.accept()
        await websocket.send_text(json.dumps({
            "type": "whiteboard_init",
            "boards": mgr.list_boards(),
        }))
        mgr.add_listener(websocket)
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    m = json.loads(raw)
                    if isinstance(m, dict) and m.get("type") == "whiteboard_viewport":
                        mgr.set_viewport(m.get("id") or DEFAULT_ID, m.get("view"))
                except Exception as e:
                    _log.debug("whiteboard_stream: ignoring non-JSON/keepalive message: %s", e)
        except WebSocketDisconnect:
            pass
        finally:
            mgr.remove_listener(websocket)

    return api
