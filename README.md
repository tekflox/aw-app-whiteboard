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

## Status: **backend + storage + agent-piloted browser ported and tested; frontend/nav registration BLOCKED on a framework capability that does not exist yet**

Per the executor instructions on this card: when the framework piece isn't
there, scaffold what can be scaffolded and stop — don't fake the nav/WS
registration.

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
  staged here as the source for the eventual `ui:code` component bundle
  (F6d pattern). **Not yet wired into a buildable plugin package** — see
  Blocked below.
- `aw-app.json` — declares the target end-state manifest (`routes:register`,
  `db:own-tables`, `ui:code`, `ui:slots:core.nav.workspace`,
  `contributes.nav` with `section: "workspace"` — Whiteboard lives in the
  WorkspaceNav flyout today, not the top bar — and
  `contributes.frontend.mode: "component"`) matching where the F6 ADR says
  this class of app is headed. Validates against `schemas/aw-app.schema.json`.
- Tests: `tests/test_manager_and_routes.py` (7 tests, real `FastAPI
  TestClient` against an in-memory-sqlite fake `ctx.db` — board CRUD, the
  viewer shell, the 501-degrade presentation round-trip, WS init +
  set-broadcast) + `tests/validate_manifest.py`. All passing
  (`.venv/aw/bin/python -m pytest tests/` → `7 passed`).

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

### Blocked — the missing framework piece

**Capability 2 of the F6 ADR — app-contributed view + nav in the SPA — is
not wired into the live `aw-frontend` shell.** Confirmed by reading the
code, not just the ADR: `aw-frontend/src/App.jsx` never calls
`installPluginHost()` or `fetchContributions()`, and no `<AppSlot>` renders
anywhere outside `apps/__tests__`. The library (`aw-frontend/src/apps/`:
`slotRegistry`, `pluginHost`, `loadPlugin`, `AppSlot`, `appsApi`) exists and
is unit-tested, but it is inert in the running app — even `aw-app-git`'s
existing declarative `nav`/`windows` entries don't render today.

On top of that, the parent ADR
(`docs/knowledge_base/docs/architecture/decoupled-apps-f6-repos-prs-migration.md`)
that specifies exactly this capability is still
**`Status: Proposed (awaiting Frederico's approval — do not implement
before approval)`** — so even if this app's job were to wire `App.jsx`
itself, that ADR explicitly says not to build it pre-approval.

Concretely, this blocks:

- Registering the "Whiteboard" WorkspaceNav-flyout item as an app
  contribution (would need `<AppSlot slot="core.nav.workspace" />`
  rendered in the shell, which isn't there).
- Shipping `ui/dist/whiteboard-ui.mjs` as a real component bundle — no
  point building it before there's a host to load it into. `ui/src/*` is
  kept as the ported source, ready to become a Vite lib build once F6b
  (SPA wiring) ships. Note also the trust gate in
  `aw-frontend/src/apps/loadPlugin.js` (`effectiveMode`): component mode
  is only honored for a **signed** app granted `ui:code` — an unsigned
  side-loaded install of this app would be auto-downgraded to iframe mode
  regardless, so even after F6b ships, this app also needs a signing story
  (or an accepted iframe degrade) before the rich component UI (export PNG,
  save-to-presentation menu) actually renders.
- **Removing the static `WhiteboardWindow.jsx` / WorkspaceNav "Whiteboard"
  entry from `aw-frontend`** — deliberately **not done** in this card.
  Removing the only working path to Whiteboard with no framework
  replacement live would break the feature for users, which the executor
  instructions explicitly say not to fake. Do this in the same follow-up as
  F6b, once `<AppSlot core.nav.workspace/>` actually renders
  app-contributed nav entries.
- The monolith's `src/api/routes/whiteboard.py` + `whiteboard_manager.py`
  + `whiteboard_browser.py` stay as-is for now too, same reasoning as F6e's
  "legacy monolith dashboard stays frozen until strangled" — it's what
  aw-frontend and the `aw-whiteboard` MCP currently talk to; nothing
  consumes `/api/apps/whiteboard/*` yet.

**What would unblock this app specifically** (once F6/Capability 2 ships,
approval permitting): wire `App.jsx`'s `installPluginHost()` +
`fetchContributions()` + `<AppSlot slot="core.nav.workspace"/>` in the
WorkspaceNav flyout, build `ui/` into a real Vite lib bundle exporting
`register(host)` (mirrors F6d's plan for `git-ui.mjs`), resolve the signing
question above, bump this app's `frontend.bundle` version, then remove the
static `WhiteboardWindow.jsx`/nav entry from `aw-frontend` and the monolith
routes once nothing points at them anymore.

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
- `ui/src/WhiteboardWindow.jsx` — ported frontend source, not yet built
  into a plugin bundle (blocked, see above).
- `tests/validate_manifest.py`, `tests/test_manager_and_routes.py`.

## Testing done

1. **Manifest validation**: `.venv/aw/bin/python tests/validate_manifest.py`
   → `OK: aw-app.json is valid and all system_clis installers exist`.
2. **Manager + routes**: `.venv/aw/bin/python -m pytest tests/` →
   `7 passed` — board create/ensure/get/list/set/delete, the viewer shell
   serving the right WS/HTML URLs, WS `whiteboard_init` + `whiteboard_update`
   broadcast on a `set`, and the presentation round-trip's clean `501` when
   unconfigured. Against a faked `ctx.db` (in-memory sqlite, same `{table}`/
   `ON CONFLICT` SQL shape the real Postgres `DbTables` facade uses — same
   pattern `aw-app-presentations` validated with).

## NOT done here (explicitly out of scope)

- No install into any workspace — Frederico installs manually after
  reviewing this, once the framework blocker above clears enough for the
  UI to actually appear.
- No real Playwright browser exercised end-to-end (no live workspace to run
  it in for this card) — `browser.py` is a faithful behavioral port,
  covered by reading/diffing against the monolith original, not a live
  screenshot-taking run.
- No marketplace signing — `ui:code` in the manifest is aspirational per
  the trust-gate note above; a side-loaded install downgrades to iframe.
