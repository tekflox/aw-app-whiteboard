// Integrated-mode entrypoint — dynamic-imported by aw-workspace-ui's
// loadComponentPlugin() once this app is installed with "ui:code" +
// "ui:slots:core.nav.workspace" granted. Built by `npm run build` ->
// ui/dist/whiteboard.js, referenced from aw-app.json's
// contributes.frontend.bundle. Same pattern as aw-app-tasks's
// ui/src/plugin.jsx — see that file's header comment for the full
// register(host)/JSX-factory explanation.
//
// Ports the "Whiteboard" row out of aw-workspace-ui's WorkspaceNav.jsx
// (hardcoded button that opened the floating window) into this app,
// mirroring the 2026-08-04 decision that moved the Tasks nav row. The
// floating window itself (WhiteboardWindow.jsx, the toolbar + live-synced
// iframe) stays owned by aw-workspace-ui for now — the framework doesn't
// support component-mode WINDOW bodies yet, only nav slots — this row's
// click reuses window.__awOpenWhiteboardPanel, the global hook App.jsx
// already exposes for it.

export function register(host) {
  function WhiteboardNavRow() {
    return (
      <button
        onClick={() => window.__awOpenWhiteboardPanel?.()}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer text-left"
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <span className="text-[13px] text-[var(--color-text-primary)]">Whiteboard</span>
      </button>
    );
  }

  host.registerSlot('core.nav.workspace', WhiteboardNavRow);
}

export default register;
