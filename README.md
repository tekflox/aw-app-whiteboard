# aw-app-whiteboard

Decoupled app for aw-workspace, per the
[Decoupled Apps Framework ADR](https://github.com/tekflox/agentic-workspace/blob/main/docs/knowledge_base/docs/architecture/decoupled-apps-framework.md)
(`aw-app.json` manifest schema v1). Absorbs the monolith's Whiteboard
feature — a persistent, live-synced HTML canvas agents can `set`/`patch`/
point at, that every open viewer reloads instantly over a WebSocket —
currently `src/api/routes/whiteboard.py` (523 lines, `/ws/whiteboard` +
`/api/whiteboards/*`) + `src/api/whiteboard_manager.py` (319 lines) +
`src/api/whiteboard_browser.py` (147 lines, agent-piloted headless browser)
in the `agentic-workspace` monolith, plus `WhiteboardWindow.jsx` (the
viewer window: export PNG, save-to-presentation) in `aw-frontend`.

Same pattern as `tekflox/aw-app-git`'s ongoing Repos/PRs migration
(`design:migrate-repos-github-into-aw-app-git`, run `18fc9a42`) and
`tekflox/aw-app-presentations`'s Presentations migration — this app
consumes the same shared framework capability: app-registered backend
routes/WebSocket + app-contributed view/nav.

## Status: **backend + storage + agent-piloted browser + nav/window all live and tested. Parity reached for the card's scope (persistent live-synced canvas + window + nav); the `aw-whiteboard` MCP stays pointed at the monolith (see nuance section) — diff tooling was never part of Whiteboard, it moved to `aw-app-git` per this card's instructions.**

2026-07-28 update: the previous run of this card left nav/window registration
blocked on F6 Capability 2 (SPA plugin-host wiring) not being live. That's
since shipped — `aw-frontend/src/App.jsx` now calls `installPluginHost()` +
`fetchContributions()` on mount, and `<AppSlot slot="core.nav.workspace"/>`
renders in `WorkspaceNav.jsx` (confirmed by reading the current code, not
just the ADR). Rather than wait further on the **component**-mode path (still
gated on real marketplace signing per `loadPlugin.js`'s `effectiveMode` — an
unsigned app is auto-downgraded to iframe regardless), this app's window now
declares `body.type: "declarative"` (`windows/main.json`, same pattern as
`aw-app-git`/`aw-app-proxy`) with an `iframe` widget pointing at this app's
own already-working `GET /view/{board_id}` viewer shell, plus two buttons for
the monolith window's export-PNG / save-to-presentation actions (backed by
routes that were already ported and tested). This is the wired, working path
today — no signing story needed — and is what `test_window_spec_endpoints_are_registered`
checks against the real route table so a stale path here can't silently 404.

### Done

- `whiteboard_app/manager.py` — `WhiteboardManager`, ported from the
  monolith's `whiteboard_manager.py` onto `ctx.db` (`db:own-tables`)
  instead of the monolith's disk-file-plus-Postgres-row split — board
  **content** lives in the DB row too now (there is no `ctx.fs`/
  `fs:workspace-data` facade yet either, a second smaller framework gap;
  putting the HTML in the DB sidesteps needing it at all). Same public
  shape (ensure/get/list/set_html/exec_js/point/close_view/delete/status/
  viewport tracking). `broadcast()` is a straight `await` now instead of
  the monolith's `call_soon_threadsafe` bridge — everything here already
  runs on the app's own event loop, so the cross-thread hop the monolith
  needed doesn't apply.
- `whiteboard_app/browser.py` — `WhiteboardBrowser`, ported verbatim
  (behaviorally) from `whiteboard_browser.py` — the agent-piloted headless
  Playwright browser (click/type/scroll/key/eval by board, screenshot after
  every action). `close_all()` added (called on `deactivate`) so uninstall
  doesn't leak chromium processes — the monolith has no uninstall path so
  never needed this.
- `whiteboard_app/viewer.py` — the live viewer shell HTML, ported
  verbatim, with the embedded JS's URLs rewritten from `/api/whiteboards/*`
  + `/ws/whiteboard` to this app's own `/api/apps/whiteboard/boards/*` +
  `/api/apps/whiteboard/ws`.
- `whiteboard_app/routes.py` — the full REST surface + `WS /ws` (replaces
  `/ws/whiteboard`), a plain FastAPI sub-app registered via
  `ctx.routes.register(...)` (mounted by the runtime at
  `/api/apps/whiteboard`). Protocol on the wire is unchanged
  (`whiteboard_init`/`whiteboard_update`/`whiteboard_exec`/
  `whiteboard_point`/`whiteboard_close`), so the ported frontend needs no
  protocol changes, only the URL-base change already applied above.
- `whiteboard_app/plugin.py` — `WhiteboardAppPlugin` entrypoint.
- `ui/src/WhiteboardWindow.jsx` — ported **verbatim** (byte-identical
  logic, only API paths updated) from `aw-frontend/src/components/`,
  kept as source for a future **component**-mode bundle (richer chrome:
  drag-resize, pop-out) once this app is marketplace-signed — see the
  "Deferred: component mode" note below. **Superseded for now** by the
  declarative window below, which is the actually-wired path today.
- `windows/main.json` — the declarative window spec (F1 body type) opened
  by the `whiteboard.nav` WorkspaceNav-flyout entry: an `iframe` widget on
  `GET /view/{board_id}` (this app's live-synced viewer shell — the exact
  parity requirement, `WS`-driven auto-reload on every `set`/`exec_js`) plus
  "Export PNG" / "Save to presentation" buttons wired to the already-ported
  `POST /boards/{id}/screenshot` / `.../save_presentation` routes (the
  monolith `WhiteboardWindow.jsx`'s chrome menu) — declarative windows'
  widget vocabulary (`aw-frontend/src/components/AppWindow.jsx`) supports
  both natively, no signing gate.
- `aw-app.json` — `routes:register`, `db:own-tables`,
  `ui:slots:core.nav.workspace` (nav lives in the WorkspaceNav flyout, same
  as the monolith); `windows[0].body` is now `{type: "declarative", spec:
  "windows/main.json"}` (was `component`, see status note above) — dropped
  `ui:code` and the `contributes.frontend` block since the declarative path
  needs neither. Validates against `schemas/aw-app.schema.json`.
- Tests: `tests/test_manager_and_routes.py` (8 tests, real `FastAPI
  TestClient` against an in-memory-sqlite fake `ctx.db` — board CRUD, the
  viewer shell, the 501-degrade presentation round-trip, WS init +
  set-broadcast, and `windows/main.json`'s iframe/button paths checked
  against the real route table) + `tests/validate_manifest.py`. All passing
  (`.venv/aw/bin/python -m pytest tests/` → `8 passed`).

### What was deliberately NOT ported as a straight copy

- **Presentation load/save round-trip** (`/boards/{id}/load_presentation`,
  `/boards/{id}/save_presentation`). The monolith imports its in-process
  `presentation_mgr` directly — an app cannot (`routes:register` is the
  only sanctioned surface into another system; apps don't import monolith/
  core internals). Ported as a best-effort HTTP call against a configurable
  `presentation_api_base` (`config_schema`), returning a clean `501` when
  unset instead of crashing or silently no-op'ing. `tekflox/aw-app-presentations`
  now exists and could become that base once it's reachable from a
  workspace — see the MCP nuance section below, this is the same open
  question in miniature.
- **Ninja/ notification integration on board changes** — the monolith's
  whiteboard has none either (unlike `github.py`'s watchdog), nothing to
  port.

### Previously blocked — now resolved (2026-07-28)

F6 Capability 2 (app-contributed view + nav in the SPA) is live:
`aw-frontend/src/App.jsx` calls `installPluginHost()` + `fetchContributions()`
on mount, and `WorkspaceNav.jsx` renders `<AppSlot slot="core.nav.workspace"/>`
in the flyout — the `whiteboard.nav` entry now mounts there and opens
`windows/main.json` for real, same wiring `aw-app-git`/`aw-app-proxy` already
rely on. This unblocks everything the previous run of this card listed as
blocked, via the declarative path rather than the component one:

- **Nav + window render** — done, real, tested against the route table
  (`test_window_spec_endpoints_are_registered`).
- **Removing the static `WhiteboardWindow.jsx` / WorkspaceNav "Whiteboard"
  entry from `aw-frontend`, and freezing the monolith's
  `whiteboard.py`/`whiteboard_manager.py`/`whiteboard_browser.py`** —
  deliberately **still not done** in this card. Per P3 (strangler-fig) and
  P5.1 (parity on a real BYOD workspace is the exit criterion), the monolith
  route only gets marked frozen and the static SPA piece only gets removed
  once this app has actually been installed and proven on a live BYOD
  workspace — not from a code review alone. No workspace was available to
  install into for this card (same "NOT done here" scope as the previous
  run). Follow-up: install, click through Export PNG / Save to presentation
  / live-sync-across-two-tabs on a real workspace, then freeze+remove.

### Deferred: component mode (richer chrome)

`ui/src/WhiteboardWindow.jsx` is kept as source for a future **component**-
mode bundle (drag-resize, a real pop-out window, an integrated toolbar
instead of two plain buttons) — closer to the monolith's exact chrome. Not
built now: `loadPlugin.js`'s `effectiveMode` gate only honors component mode
for a **signed** app granted `ui:code`, and real marketplace signing (F8) is
still W3+ work; an unsigned install downgrades to iframe regardless, so
there's no functional gain over the declarative window shipped here until
signing lands. Revisit together with `aw-app-git`'s and
`aw-app-presentations`' equivalent component-mode plans.

### Known framework gap (not specific to this app, not blocking)

`AppWindow.jsx`'s `iframe` widget renders `<iframe src={widget.src}>` with
the raw manifest-declared path, unlike `fetch()`/`WebSocket`, which
`apiBase.js` transparently rewrites to the BYOD workspace API host on a
`<slug>.workspace.<apex>` SPA. On the single-tenant dashboard (same-origin,
`BASES.api` empty) this is a no-op and the iframe works today as tested; on
a cloud workspace SPA host the relative `/api/apps/whiteboard/view/main` src
would resolve against the SPA's own static host instead of the workspace,
breaking the canvas. This is a pre-existing gap in `apiBase.js`/
`AppWindow.jsx` that affects any app shipping an `iframe` window widget, not
something whiteboard-specific to fix here — flagging per the M1 step-3
protocol rather than hacking a per-app workaround into this card.

## The `aw-whiteboard` MCP nuance (mapped, not resolved)

`src/mcp/whiteboard-server.py` (stdio MCP, tools: `whiteboard_show_html` /
`whiteboard_exec_js` / `whiteboard_point` / `whiteboard_load_presentation` /
`whiteboard_save_presentation` / `whiteboard_browse` / `whiteboard_click` /
`whiteboard_type` / `whiteboard_key` / `whiteboard_scroll` /
`whiteboard_eval` / `whiteboard_screenshot` / `whiteboard_close` /
`whiteboard_status` / `whiteboard_get` / `whiteboard_list`) is how agents
draw on/pilot the whiteboard today. It talks HTTP to **awserv** (the
monolith control plane) at a fixed base URL + API key (`_get_api_key()`
reads it fresh each time so it survives awserv restarts) — i.e. it drives
the monolith's `WhiteboardManager`/`WhiteboardBrowser`/Postgres, not any
per-workspace store.

Same two-audience split identified by `aw-app-presentations` for its own
MCP, applies here **plus one extra wrinkle specific to Whiteboard** — the
agent-piloted browser tools (`browse`/`click`/`type`/`key`/`scroll`/`eval`/
`screenshot`) hold a **stateful Playwright session per board**, so whichever
side owns the manager also has to own that live browser process:

1. **Monolith-only agents** (the common case today) have no notion of
   "which BYOD workspace" — pointing the MCP at a *workspace's*
   `/api/apps/whiteboard/*` instead of awserv's own `/api/whiteboards/*`
   needs a target workspace concept that doesn't exist for this class of
   caller.
2. **A workspace-scoped agent** could target that workspace's own
   `/api/apps/whiteboard/*` — but the MCP has no such mode today, and
   per-workspace auth (the IdentityGuard gap noted above) isn't solved
   either. For the browser-piloting tools specifically, the workspace app
   would also need `net:outbound`-reachable Playwright, which the manifest
   already grants (`pip_requires: playwright`) — no extra framework gap
   there, just the routing/auth one shared with every other tool.

**Proposal (for coordination with the F6/framework design, not implemented
here):** keep `aw-whiteboard` MCP → **monolith** `WhiteboardManager` as the
default/only path for now (covers effectively every current caller,
including this very session). If/when a workspace-scoped agent story
exists, extend it the same way `aw-app-presentations` proposed for its own
MCP — either a `workspace_base_url` override or a separate workspace-local
MCP — rather than deciding unilaterally per-app. Flagging on the Kanban
card per the "PARE e reporte" instruction.

## Layout

- `aw-app.json` — manifest (id `whiteboard`, tier `inprocess`).
- `schemas/aw-app.schema.json` — local structural validator (same
  stand-in copy `aw-app-git`/`aw-app-presentations` use).
- `whiteboard_app/manager.py` — `WhiteboardManager` (`ctx.db`-backed).
- `whiteboard_app/browser.py` — `WhiteboardBrowser` (agent-piloted
  Playwright, per-board persistent page).
- `whiteboard_app/viewer.py` — the live viewer shell HTML (`VIEWER_SHELL`).
- `whiteboard_app/routes.py` — FastAPI sub-app (REST + `WS /ws`).
- `whiteboard_app/plugin.py` — `WhiteboardAppPlugin` entrypoint.
- `windows/main.json` — declarative window spec (`iframe` + export/save
  buttons), resolved into `body.spec_data` by the runtime and rendered by
  `AppWindow.jsx` when `whiteboard.nav` is clicked.
- `ui/src/WhiteboardWindow.jsx` — ported frontend source, deferred
  component-mode bundle (see "Deferred: component mode" above).
- `tests/validate_manifest.py`, `tests/test_manager_and_routes.py`.

## Testing done

1. **Manifest validation**: `.venv/aw/bin/python tests/validate_manifest.py`
   → `OK: aw-app.json is valid and all system_clis installers exist`.
2. **Manager + routes**: `.venv/aw/bin/python -m pytest tests/` →
   `8 passed` — board create/ensure/get/list/set/delete, the viewer shell
   serving the right WS/HTML URLs, WS `whiteboard_init` + `whiteboard_update`
   broadcast on a `set`, the presentation round-trip's clean `501` when
   unconfigured, and `windows/main.json`'s iframe/button paths checked
   against the real registered route table. Against a faked `ctx.db`
   (in-memory sqlite, same `{table}`/`ON CONFLICT` SQL shape the real
   Postgres `DbTables` facade uses — same pattern `aw-app-presentations`
   validated with).

## NOT done here (explicitly out of scope)

- No install into any real workspace, and no live-BYOD parity proof — this
  card's evidence is code + tests against a faked `ctx`, same as the
  `aw-app-git`/`aw-app-presentations` precedent; installing and freezing the
  monolith route is the deferred follow-up (see "Previously blocked" above).
- No real Playwright browser exercised end-to-end (no live workspace to run
  it in for this card) — `browser.py` is a faithful behavioral port,
  covered by reading/diffing against the monolith original, not a live
  screenshot-taking run.
- No marketplace signing / component-mode bundle build — deferred, see
  "Deferred: component mode" above; the declarative window shipped here
  needs neither.
- The `apiBase.js` iframe-src rewrite gap (see "Known framework gap" above)
  — cross-app framework fix, not this card's scope.
