# Whiteboard

Whiteboard adds persistent, live-synced HTML boards to an AW Workspace. It gives users and agents a shared visual surface for diagrams, notes, sketches, plans, and generated visual content.

## What It Does

- Creates and stores named whiteboards.
- Opens a whiteboard window from the workspace navigation.
- Syncs board updates live to open viewers.
- Supports full HTML content for rich visual layouts.
- Lets boards be updated directly or patched in place.

## Why Use It

Use this app when a task needs a visual workspace instead of plain text. It is useful for diagrams, workflow maps, planning boards, collaborative notes, UX sketches, and agent-generated visual explanations.

## How To Use It

Install the app and open Whiteboard from the workspace navigation. Use the default board or create a named board for a specific topic. Users and agents can update the board while viewers see changes live.

## What It Delivers

The app gives AW Workspace a persistent visual canvas. It helps turn ideas, plans, and explanations into shared workspace artifacts that can stay available after the session ends.

## MCP Server

`mcp_server/` ships a standalone stdio MCP that lets an agent drive Whiteboard from outside the workspace process, authenticating with the workspace's shared API key instead of a browser session. See `mcp_server/README.md` for setup and the full tool list, and `docs/app-workspace-api-auth.md` in `tekflox/aw-app-template` for the general pattern any app/MCP can reuse to call an aw-workspace API.
