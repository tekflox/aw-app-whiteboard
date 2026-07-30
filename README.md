# aw-app-whiteboard

Workspace app for persistent, live-synced HTML whiteboards that agents and
users can view, edit, point at, and pilot through browser automation.

## Features

- Whiteboard CRUD and status routes.
- WebSocket broadcast for live viewer updates.
- Persistent board content stored through `ctx.db`.
- Agent-piloted Playwright browser actions for a board.
- Declarative workspace window with an iframe viewer and action buttons.
- Optional presentation load/save integration through a configured API base.

## Status

Backend routes, storage, browser helper logic, and the declarative window are
implemented and covered by tests. Install and live workspace validation are
handled outside this repository.

## Layout

- `aw-app.json` - manifest for the `whiteboard` app.
- `schemas/aw-app.schema.json` - local structural validator.
- `whiteboard_app/manager.py` - board storage and broadcast manager.
- `whiteboard_app/browser.py` - Playwright browser controller.
- `whiteboard_app/viewer.py` - live viewer shell HTML.
- `whiteboard_app/routes.py` - FastAPI sub-app with REST and WebSocket
  routes.
- `whiteboard_app/plugin.py` - plugin entrypoint.
- `windows/main.json` - declarative window spec.
- `ui/src/WhiteboardWindow.jsx` - frontend source for a richer window.
- `tests/validate_manifest.py` - manifest validation.
- `tests/test_manager_and_routes.py` - manager and route coverage.

## Testing

```bash
.venv/aw/bin/python tests/validate_manifest.py
.venv/aw/bin/python -m pytest tests/
```

Live browser automation should also be checked in an installed workspace.
