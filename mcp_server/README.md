# Whiteboard MCP server

A standalone stdio MCP server for the Whiteboard app. It runs as its own
process (not inside the aw-workspace container) and talks to a running
workspace's `/api/apps/whiteboard/*` routes over plain HTTP, authenticating
with the workspace's shared `X-Api-Key` header — no browser session, no
per-app config field to fill in.

This is the general pattern for calling into an aw-workspace API from
outside the workspace process — see
[`docs/app-workspace-api-auth.md`](https://github.com/tekflox/aw-app-template/blob/master/docs/app-workspace-api-auth.md)
in `aw-app-template` for the full write-up with a from-scratch code example.

## Requirements

```
pip install httpx
```

(Already a dependency of the Whiteboard app itself — see `aw-app.json`'s
`runtime.pip_requires`.)

## Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `AW_WORKSPACE_API_URL` | no | `http://127.0.0.1:9030` | Base URL of the aw-workspace API. |
| `AW_WORKSPACE_API_KEY` | no* | — | The workspace's shared API key, read fresh on every call. |
| `AW_WORKSPACE_ENV_FILE` | no | `~/.aw-workspace/.env` | Fallback file to read `AW_WORKSPACE_API_KEY` from when the env var isn't set. |

\* At least one of `AW_WORKSPACE_API_KEY` or a readable `AW_WORKSPACE_ENV_FILE`
containing it is required, or every call gets a 401. aw-workspace writes the
key to `<AW_WORKSPACE_HOME>/.env` on every generate/regenerate (see Settings
→ Integrations → Workspace API Key in the workspace UI), so pointing
`AW_WORKSPACE_ENV_FILE` at that same file — or just running this MCP on the
same machine, where the default path already matches — means a regenerated
key takes effect on the very next tool call, no restart needed.

## Run

```bash
AW_WORKSPACE_API_URL=http://127.0.0.1:9030 \
AW_WORKSPACE_API_KEY=<paste the key from Settings → Integrations> \
python -m mcp_server.server
```

Wire it into an MCP client's config as a stdio server, e.g.:

```json
{
  "mcpServers": {
    "aw-app-whiteboard": {
      "type": "stdio",
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/path/to/aw-app-whiteboard",
      "env": {
        "AW_WORKSPACE_API_URL": "http://127.0.0.1:9030",
        "AW_WORKSPACE_API_KEY": "..."
      }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `whiteboard_show_html` | Replace a board's HTML — every open viewer reloads instantly. |
| `whiteboard_get` | Read a board's current HTML + metadata. |
| `whiteboard_list` | List every board on the workspace. |
| `whiteboard_delete` | Delete a board's content (re-creates blank on next access). |
| `whiteboard_exec_js` | Run JS in every open viewer, live, not persisted. |
| `whiteboard_point` | Scroll to + highlight an element by selector or visible text. |
| `whiteboard_close` | Close the board's window on every viewer. |
| `whiteboard_status` | Section outline, viewer count, live scroll position. |
| `whiteboard_screenshot` | Real headless-browser screenshot of the board's content. |
| `whiteboard_browse` / `whiteboard_click` / `whiteboard_type` / `whiteboard_key` / `whiteboard_scroll` / `whiteboard_eval` | Drive an agent-piloted headless browser embedded in the board. |
| `whiteboard_browser_close` | Close that piloted browser session. |
| `whiteboard_load_presentation` / `whiteboard_save_presentation` | Round-trip with a presentation (needs `presentation_api_base` configured — 501s otherwise). |

Every tool takes an optional `id` (board id, default `"main"`).

## Tests

```bash
pip install pytest httpx
python -m pytest tests/test_mcp_server.py -q
```

Mocks the outbound HTTP call — no real workspace needed to run these.
