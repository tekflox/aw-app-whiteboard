"""A headless browser the agent can PILOT inside the whiteboard context.

Ported verbatim (behaviorally) from the monolith's ``src/api/whiteboard_browser.py``.
Holds one persistent Playwright page per board so the agent can click by
coordinates, type, scroll, press keys, and run JS — driving whatever the board
loads (an embedded app, a website) like a real browser. Every action returns a
fresh screenshot.

Runs its own chromium via Playwright's async API on the app's event loop.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from urllib.parse import urlparse

logger = logging.getLogger("whiteboard_app.browser")

# CSS-pixel viewport. device_scale_factor=1 so screenshot pixels == CSS pixels
# == the coordinates the agent clicks with (no 2x math to reconcile).
_VIEWPORT = {"width": 1280, "height": 800}


def workspace_api_headers(url: str, own_base_url: str) -> dict:
    """``X-Api-Key`` for a request to THIS workspace, and an empty dict for
    anything else.

    The board's own HTML lives behind ``/api/apps/whiteboard/...``, which the
    runtime's IdentityGuard gates. A headless browser carries no session, so it
    fetched the 401 body and screenshotted *that* — a valid PNG of
    ``{"error": "unauthorized"}``, returned with a path and a byte count, which
    is why it read as working for weeks.

    Scoped to our own origin ON PURPOSE. Playwright's ``extra_http_headers``
    apply to every request a context makes, and ``browse`` accepts an arbitrary
    URL — so setting the key unconditionally would hand this workspace's API
    key to whatever site someone browsed to. That would be a worse bug than the
    one this fixes.
    """
    if not own_base_url:
        return {}                       # unknown own origin -> fail closed
    try:
        target, own = urlparse(url), urlparse(own_base_url)
    except ValueError:
        return {}
    # Compare the parsed ORIGIN, not a string prefix. `url.startswith(own)`
    # accepts "http://127.0.0.1:9030.evil.test/" — same leading characters,
    # entirely different host — which would send the key exactly where it must
    # never go.
    if (target.scheme, target.netloc) != (own.scheme, own.netloc):
        return {}
    key = os.environ.get("AW_WORKSPACE_API_KEY")
    return {"X-Api-Key": key} if key else {}


def screenshot_url(url: str, output_path: str, width: int, height: int,
                   scale: float, full_page: bool, wait_ms: int,
                   own_base_url: str = "") -> None:
    """Synchronous headless-chromium screenshot of ``url``, run in a worker
    thread. THE one copy — ``routes.py`` and ``mcp/http_handler.py`` both call
    this.

    They used to hold a byte-identical copy each, and the divergence is exactly
    how the unauthorized-PNG bug survived its own fix: routes.py got the
    ``X-Api-Key`` and the MCP handler — the copy every agent actually reaches —
    did not, so the screenshot kept coming back as a picture of
    ``{"detail":"unauthorized"}`` with the fix apparently deployed.
    """
    from playwright.sync_api import sync_playwright

    headers = workspace_api_headers(url, own_base_url)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            context = browser.new_context(viewport={"width": width, "height": height},
                                          device_scale_factor=scale,
                                          extra_http_headers=headers)
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


class WhiteboardBrowser:
    def __init__(self, shot_dir: str, own_base_url: str = ""):
        self._shot_dir = shot_dir
        self._own_base_url = own_base_url.rstrip("/")
        self._pw = None
        self._sessions: dict[str, dict] = {}   # board_id -> {browser, context, page}
        self._lock = asyncio.Lock()

    async def _ensure_pw(self):
        if self._pw is None:
            from playwright.async_api import async_playwright
            self._pw = await async_playwright().start()
        return self._pw

    async def ensure_page(self, board_id: str, url: str | None = None, default_url: str | None = None):
        """Return the persistent page for this board, launching it (and
        navigating to the board content or a given URL) on first use."""
        async with self._lock:
            s = self._sessions.get(board_id)
            first = s is None
            if first:
                pw = await self._ensure_pw()
                browser = await pw.chromium.launch(args=["--no-sandbox"])
                context = await browser.new_context(viewport=_VIEWPORT, device_scale_factor=1)
                page = await context.new_page()
                s = {"browser": browser, "context": context, "page": page}
                self._sessions[board_id] = s
                if url is None:
                    url = default_url
            if url:
                page = s["page"]
                # Per navigation rather than on the context: the same page is
                # reused for later browse() calls to arbitrary URLs, and a
                # header set on the context would follow them there.
                await page.set_extra_http_headers(
                    workspace_api_headers(url, self._own_base_url))
                try:
                    await page.goto(url, wait_until="networkidle", timeout=20000)
                except Exception:
                    try:
                        await page.goto(url, wait_until="load", timeout=20000)
                    except Exception as exc:
                        logger.warning("whiteboard browser goto failed: %s", exc)
            return s["page"]

    async def _page(self, board_id: str, default_url: str | None = None):
        s = self._sessions.get(board_id)
        if s is None:
            return await self.ensure_page(board_id, default_url=default_url)
        return s["page"]

    async def screenshot(self, board_id: str, full_page: bool = False, path: str | None = None) -> str:
        page = await self._page(board_id)
        os.makedirs(self._shot_dir, exist_ok=True)
        path = path or os.path.join(self._shot_dir, f"{board_id}-live-{int(time.time())}.png")
        await page.screenshot(path=path, full_page=full_page)
        return path

    async def click(self, board_id: str, x: float, y: float, double: bool = False) -> str:
        page = await self._page(board_id)
        if double:
            await page.mouse.dblclick(x, y)
        else:
            await page.mouse.click(x, y)
        await page.wait_for_timeout(500)
        return await self.screenshot(board_id)

    async def type_text(self, board_id: str, text: str, submit: bool = False) -> str:
        page = await self._page(board_id)
        await page.keyboard.type(text, delay=18)
        if submit:
            await page.keyboard.press("Enter")
        await page.wait_for_timeout(400)
        return await self.screenshot(board_id)

    async def press(self, board_id: str, key: str) -> str:
        page = await self._page(board_id)
        await page.keyboard.press(key)
        await page.wait_for_timeout(400)
        return await self.screenshot(board_id)

    async def scroll(self, board_id: str, dy: int, dx: int = 0) -> str:
        page = await self._page(board_id)
        await page.mouse.wheel(dx, dy)
        await page.wait_for_timeout(300)
        return await self.screenshot(board_id)

    async def eval_js(self, board_id: str, js: str):
        page = await self._page(board_id)
        try:
            result = await page.evaluate(js)
        except Exception as exc:
            result = f"error: {exc}"
        shot = await self.screenshot(board_id)
        return result, shot

    async def browse(self, board_id: str, url: str) -> str:
        await self.ensure_page(board_id, url=url)
        return await self.screenshot(board_id)

    async def close(self, board_id: str) -> bool:
        s = self._sessions.pop(board_id, None)
        if not s:
            return False
        try:
            await s["browser"].close()
        except Exception:
            pass
        return True

    async def close_all(self) -> None:
        for board_id in list(self._sessions):
            await self.close(board_id)
