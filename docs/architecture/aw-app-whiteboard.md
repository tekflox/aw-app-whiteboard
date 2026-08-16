---
repo: architecture
path: docs/architecture/aw-app-whiteboard.md
source: generated
edited: false
checksum: sha256:e62aca75e392dd781a93ff1234c736115e256c8ef48bb4fd9c15769eab16cec7
---
# Whiteboard

- **repo**: aw-app-whiteboard
- **layer**: app
- **technologies**: python, react
- **health** (derived): planned

Persistent, live-synced HTML canvas — set/patch content, broadcast changes over a WebSocket to every open viewer, round-trip with a presentation. Migrated from the aw monolith (src/api/routes/whiteboard.py + whiteboard_manager.py + WhiteboardWindow.jsx).

## Connections
- `db` → **postgres** — app-owned tables in the workspace schema
- `http` → **aw-workspace** — routes mounted at /api/apps/whiteboard
- `stdio-mcp` → **mcp-gateway** — MCP surface aggregated by the gateway

## MCP tools
- `whiteboard_browse`
- `whiteboard_browser_close`
- `whiteboard_click`
- `whiteboard_close`
- `whiteboard_delete`
- `whiteboard_eval`
- `whiteboard_exec_js`
- `whiteboard_get`
- `whiteboard_key`
- `whiteboard_list`
- `whiteboard_load_presentation`
- `whiteboard_point`
- `whiteboard_save_presentation`
- `whiteboard_screenshot`
- `whiteboard_scroll`
- `whiteboard_show_html`
- `whiteboard_status`
- `whiteboard_type`

## Requirements
_none documented_
