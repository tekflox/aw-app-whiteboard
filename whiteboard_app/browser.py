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

logger = logging.getLogger("whiteboard_app.browser")

# CSS-pixel viewport. device_scale_factor=1 so screenshot pixels == CSS pixels
# == the coordinates the agent clicks with (no 2x math to reconcile).
_VIEWPORT = {"width": 1280, "height": 800}


class WhiteboardBrowser:
    def __init__(self, shot_dir: str):
        self._shot_dir = shot_dir
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
