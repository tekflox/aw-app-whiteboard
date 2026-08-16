"""Entrypoint referenced by aw-app.json's runtime.entrypoint
("whiteboard_app.plugin:WhiteboardAppPlugin").

Ports the monolith's ``/ws/whiteboard`` + ``/api/whiteboards/*``
(``src/api/routes/whiteboard.py``, 523 lines, + ``whiteboard_manager.py``,
319 lines) onto the F4 ``ctx`` facades:

* ``ctx.routes`` (``routes:register``) — HTTP + WebSocket sub-app mounted at
  ``/api/apps/whiteboard`` by the runtime.
* ``ctx.db`` (``db:own-tables``) — board content + metadata live in this
  app's own Postgres table (``app__whiteboard__boards``) instead of the
  monolith's disk file + ``WhiteboardRecord`` Postgres row split.

Known gap (see repo README + Kanban card comment, same one
``tekflox/aw-app-presentations`` hit): the manifest also declares ``ui:code``
/ ``ui:slots:core.nav.workspace`` / ``contributes.frontend`` for the
"Whiteboard" workspace-nav entry + window, matching where the F6 ADR
(``design:migrate-repos-github-into-aw-app-git``, still *Proposed — awaiting
approval*) says this capability is headed — but the SPA plugin-host wiring
(``installPluginHost``/``fetchContributions``/``<AppSlot>``) is NOT yet
called anywhere in ``aw-frontend/src/App.jsx``, so these manifest entries
are inert until that framework piece ships. Do not remove the monolith's
static ``WhiteboardWindow.jsx`` / nav entry until it lands — there is no
working replacement yet.
"""

from __future__ import annotations

import logging
import os

from . import routes as routes_mod
from .browser import WhiteboardBrowser
from .manager import WhiteboardManager
from .mcp import self_register as mcp_self_register

log = logging.getLogger("aw_apps.whiteboard")


class WhiteboardAppPlugin:
    async def activate(self, ctx) -> None:
        self.ctx = ctx
        self.mgr = WhiteboardManager(ctx)

        shot_dir = os.path.join(
            os.path.dirname(__file__), "..", ".data", "whiteboard-shots"
        )
        os.makedirs(shot_dir, exist_ok=True)
        self._shot_dir = shot_dir

        port = int(os.environ.get("AW_PORT", "9030"))
        own_base_url = f"http://127.0.0.1:{port}"
        self.browser = WhiteboardBrowser(shot_dir, own_base_url)

        subapp = routes_mod.build_routes(ctx, self.mgr, self.browser, shot_dir, own_base_url)
        ctx.routes.register(subapp)
        ctx.on_deactivate(self._teardown)

        # Discoverable by aw-mcp-gateway's app-scan — see mcp/self_register.py.
        mcp_self_register.register_self(ctx.package_dir, port)

        log.info("aw-app-whiteboard activated")

    async def deactivate(self) -> None:
        log.info("aw-app-whiteboard deactivated")

    async def _teardown(self) -> None:
        # WS unload contract (F6 Capability 1): the runtime drains the Mount
        # itself; this clears our own listener bookkeeping (stale broadcast
        # after unload becomes a no-op) and closes the agent-piloted browser
        # sessions so no headless chromium process leaks past uninstall.
        for ws in list(self.mgr._listeners):
            self.mgr.remove_listener(ws)
        await self.browser.close_all()
