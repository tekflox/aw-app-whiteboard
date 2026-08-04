// Integrated-mode entrypoint — dynamic-imported by aw-workspace-ui's
// loadComponentPlugin() once this app is installed with "ui:code" +
// "ui:slots:core.nav.workspace" granted. Built by `npm run build` ->
// ui/dist/whiteboard.js, referenced from aw-app.json's
// contributes.frontend.bundle. Same pattern as aw-app-tasks's
// ui/src/plugin.jsx — see that file's header comment for the full
// register(host)/JSX-factory explanation.
//
// Owns BOTH contributions this app makes to the SPA (2026-08-04 decision:
// aw-workspace-ui carries zero app-specific window/nav logic — it only
// supplies the generic BasicWindow chrome and slot registry):
//
// 1. WhiteboardNavRow -> core.nav.workspace — the "Whiteboard" row inside
//    the Workspace popover. Also owns the live-update WebSocket (moved
//    here from aw-workspace-ui's App.jsx, which used to auto-open+focus
//    the window whenever an agent pushed new content via MCP show_html /
//    load_presentation) — this component is always mounted once the app
//    loads, so it's the natural home for a standing background listener,
//    unlike the window body below which only exists while the window is
//    actually open.
// 2. WhiteboardWindowBody -> core.window.body:whiteboard.main — the full
//    floating-window content (toolbar: save-to-presentation / export PNG /
//    pop-out + the live-synced iframe), registered via host.registerWindow.
//    Ported from this app's own staged ui/src/WhiteboardWindow.jsx (itself
//    a verbatim copy of aw-workspace-ui's now-deleted WhiteboardWindow.jsx,
//    just with the API paths already pointed at this app's own routes).
//    aw-app.json's windows[0].body.type is "component" now, not
//    "declarative" — BasicWindow.jsx renders this slot instead of the
//    widget-spec renderer for that mode.

import { toPng } from 'html-to-image';

export function register(host) {
  const { useState, useRef, useCallback, useEffect } = host.React;

  function WhiteboardIcon() {
    return (
      <svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );
  }

  // ------------------------------------------------------------------
  // 1. Nav row + standing live-update listener
  // ------------------------------------------------------------------
  function WhiteboardNavRow() {
    useEffect(() => {
      let ws, reconnectTimer, closed = false;
      const bringToFront = () => window.__awOpenAppWindow?.('whiteboard.main');
      const connect = () => {
        try {
          ws = new WebSocket(host.app.wsUrl('/ws'));
          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              // Only `set` (new content) pops the window — `exec_js` overlays
              // and `init` handshakes must not yank the user's view.
              if (msg.type === 'whiteboard_update' && msg.action === 'set') bringToFront();
            } catch {}
          };
          ws.onclose = () => { if (!closed) reconnectTimer = setTimeout(connect, 5000); };
          ws.onerror = () => { try { ws.close(); } catch {} };
        } catch {
          if (!closed) reconnectTimer = setTimeout(connect, 5000);
        }
      };
      connect();
      return () => {
        closed = true;
        clearTimeout(reconnectTimer);
        if (ws) { ws.onclose = null; try { ws.close(); } catch {} }
      };
    }, []);

    return (
      <button
        onClick={() => window.__awOpenAppWindow?.('whiteboard.main')}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer text-left"
      >
        <WhiteboardIcon />
        <span className="text-[13px] text-[var(--color-text-primary)]">Whiteboard</span>
      </button>
    );
  }

  // ------------------------------------------------------------------
  // 2. Window body — toolbar + live-synced iframe
  // ------------------------------------------------------------------
  function WhiteboardWindowBody({ windowKey, onMaximize, isMaximized }) {
    const boardId = 'main';
    // Absolute URL required here — <iframe src> and window.open() are
    // resolved directly by the browser, bypassing the fetch/XHR-only
    // apiBase.js rewrite shim a relative apiUrl() depends on.
    const viewUrl = host.app.absoluteApiUrl(`/view/${encodeURIComponent(boardId)}`);
    const iframeRef = useRef(null);
    const [saving, setSaving] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [presId, setPresId] = useState('');
    const [note, setNote] = useState(null);

    const doSave = useCallback(async (asNew) => {
      setSaving(true);
      setNote(null);
      try {
        const body = asNew && presId.trim() ? { presentation_id: presId.trim() } : {};
        const res = await host.sdk.api.fetch(
          host.app.apiUrl(`/boards/${encodeURIComponent(boardId)}/save_presentation`),
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        );
        const data = await res.json();
        if (data.success) {
          setNote(`✓ ${data.action} "${data.presentation_id}"`);
          setSaveOpen(false);
          setPresId('');
        } else {
          setNote(`⚠ ${data.detail || data.error || 'save failed'}`);
        }
      } catch (e) {
        setNote(`⚠ ${e.message}`);
      } finally {
        setSaving(false);
        setTimeout(() => setNote(null), 4000);
      }
    }, [presId]);

    const handleExport = useCallback(async () => {
      const shell = iframeRef.current;
      if (!shell) return;
      try {
        const shellDoc = shell.contentDocument;
        const inner = shellDoc?.getElementById('frame');
        const doc = (inner && inner.contentDocument) || shellDoc;
        if (!doc || !doc.body) { setNote('⚠ nada para exportar'); setTimeout(() => setNote(null), 3000); return; }
        const dataUrl = await toPng(doc.documentElement, {
          backgroundColor: '#ffffff', pixelRatio: 2,
          width: doc.documentElement.scrollWidth, height: doc.documentElement.scrollHeight,
        });
        const link = document.createElement('a');
        link.download = `whiteboard-${boardId}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Whiteboard export failed:', err);
        setNote('⚠ export falhou');
        setTimeout(() => setNote(null), 4000);
      }
    }, []);

    return (
      <div className="flex flex-col bg-[var(--color-bg-secondary)] h-full">
        <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-b border-[var(--color-border)] shrink-0">
          {note && <span className="text-[10px] text-[var(--color-text-muted)] truncate mr-auto pl-1">{note}</span>}
          <div className="relative">
            <button
              onClick={() => { setSaveOpen((v) => !v); setNote(null); }}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Save whiteboard to a presentation"
            >
              <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
            </button>
            {saveOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-3"
                style={{ minWidth: 240 }}
              >
                <div className="text-[11px] font-medium text-[var(--color-text-primary)] mb-2">Save to presentation</div>
                <button
                  onClick={() => doSave(false)}
                  disabled={saving}
                  className="w-full text-left text-[11px] px-3 py-1.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors mb-2 disabled:opacity-50"
                >
                  Save back to linked presentation
                </button>
                <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Or save as a new/other presentation:</div>
                <div className="flex items-center gap-1.5">
                  <input
                    value={presId}
                    onChange={(e) => setPresId(e.target.value)}
                    placeholder="presentation-id"
                    className="flex-1 text-[11px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                  />
                  <button
                    onClick={() => doSave(true)}
                    disabled={saving || !presId.trim()}
                    className="shrink-0 text-[11px] px-2 py-1 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 transition-colors disabled:opacity-40"
                  >
                    Save as
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={handleExport} className="p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer" title="Export as PNG">
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={() => window.open(viewUrl, `whiteboard-${boardId}`, 'popup=1,width=1100,height=760')}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Pop out to new window"
          >
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
          <button onClick={() => onMaximize?.(windowKey)} className="p-1.5 rounded hover:bg-white/10 transition-colors" title={isMaximized ? 'Restore' : 'Maximize'}>
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
          </button>
        </div>
        <div className="flex-1 relative bg-[var(--color-bg-primary)]">
          <iframe ref={iframeRef} src={viewUrl} className="absolute inset-0 w-full h-full border-0" title="Whiteboard" />
        </div>
      </div>
    );
  }

  host.registerSlot('core.nav.workspace', WhiteboardNavRow);
  host.registerWindow('whiteboard.main', WhiteboardWindowBody);
}

export default register;
