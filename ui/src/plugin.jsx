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
// 2. WhiteboardWindowBody -> core.window.body:whiteboard.main — the
//    live-synced iframe, registered via host.registerWindow.
// 3. WhiteboardWindowActions -> core.window.titlebar:whiteboard.main —
//    save-to-presentation / export PNG / pop-out, registered via
//    host.registerWindowActions so they land in the HOST's title bar.
//    These used to be a second full-width toolbar drawn above the iframe in
//    (2), back when a window's chrome was closed to apps — two stacked
//    headers, with a Maximize button duplicating the host's own.
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
  // 2. Window title-bar actions + body
  // ------------------------------------------------------------------
  // These are SIBLING slot contributions, not parent/child: the host renders
  // the actions inside its own header (core.window.titlebar:whiteboard.main)
  // and the body below it (core.window.body:whiteboard.main). Export-as-PNG
  // needs the body's <iframe>, so the body publishes its element here and the
  // actions read it back, keyed by windowKey (one entry per open window).
  const iframesByWindow = new Map();

  function WhiteboardWindowActions({ windowKey }) {
    const boardId = 'main';
    const viewUrl = host.app.absoluteApiUrl(`/view/${encodeURIComponent(boardId)}`);
    const [saving, setSaving] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [presId, setPresId] = useState('');
    const [note, setNote] = useState(null);
    const saveBtnRef = useRef(null);
    const [anchor, setAnchor] = useState(null);

    // BasicWindow's root is overflow-hidden (rounded corners), so an
    // `absolute` popover in the header gets clipped. Portal to document.body
    // with fixed coords taken from the button instead.
    const toggleSave = useCallback(() => {
      setNote(null);
      setSaveOpen((open) => {
        if (open) return false;
        const r = saveBtnRef.current?.getBoundingClientRect();
        if (r) setAnchor({ top: r.bottom + 6, right: window.innerWidth - r.right });
        return true;
      });
    }, []);

    // Close on outside click / Escape — a portalled popover is outside the
    // window's own DOM subtree, so nothing else would dismiss it.
    useEffect(() => {
      if (!saveOpen) return undefined;
      const onDown = (e) => {
        if (saveBtnRef.current?.contains(e.target)) return;
        if (e.target.closest?.('[data-wb-save-popover]')) return;
        setSaveOpen(false);
      };
      const onKey = (e) => { if (e.key === 'Escape') setSaveOpen(false); };
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onDown);
        document.removeEventListener('keydown', onKey);
      };
    }, [saveOpen]);

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
          setNote(`\u2713 ${data.action} "${data.presentation_id}"`);
          setSaveOpen(false);
          setPresId('');
        } else {
          setNote(`\u26a0 ${data.detail || data.error || 'save failed'}`);
        }
      } catch (e) {
        setNote(`\u26a0 ${e.message}`);
      } finally {
        setSaving(false);
        setTimeout(() => setNote(null), 4000);
      }
    }, [presId]);

    const handleExport = useCallback(async () => {
      const shell = iframesByWindow.get(windowKey);
      if (!shell) { setNote('\u26a0 nada para exportar'); setTimeout(() => setNote(null), 3000); return; }
      try {
        const shellDoc = shell.contentDocument;
        const inner = shellDoc?.getElementById('frame');
        const doc = (inner && inner.contentDocument) || shellDoc;
        if (!doc || !doc.body) { setNote('\u26a0 nada para exportar'); setTimeout(() => setNote(null), 3000); return; }
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
        setNote('\u26a0 export falhou');
        setTimeout(() => setNote(null), 4000);
      }
    }, [windowKey]);

    // No Maximize button here on purpose — the host's header already has one
    // (BasicWindow), and duplicating it was half the reason this app had a
    // second bar at all.
    return (
      <>
        {note && (
          <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[160px] mr-1">{note}</span>
        )}
        <button
          ref={saveBtnRef}
          onClick={toggleSave}
          className="p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]"
          title="Save whiteboard to a presentation"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
          </svg>
        </button>
        <button
          onClick={handleExport}
          className="p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]"
          title="Export as PNG"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button
          onClick={() => window.open(viewUrl, `whiteboard-${boardId}`, 'popup=1,width=1100,height=760')}
          className="p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]"
          title="Pop out to new window"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
        {saveOpen && anchor && host.ReactDOM.createPortal(
          <div
            data-wb-save-popover
            className="fixed z-[1000] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-3"
            style={{ top: anchor.top, right: anchor.right, minWidth: 240 }}
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
          </div>,
          document.body,
        )}
      </>
    );
  }

  // Body is now JUST the canvas — the toolbar that used to sit above this
  // iframe moved into the host's title bar (WhiteboardWindowActions), so the
  // window has one header instead of two and the canvas gets that ~34px back.
  function WhiteboardWindowBody({ windowKey }) {
    const boardId = 'main';
    // Absolute URL required here — <iframe src> and window.open() are
    // resolved directly by the browser, bypassing the fetch/XHR-only
    // apiBase.js rewrite shim a relative apiUrl() depends on.
    const viewUrl = host.app.absoluteApiUrl(`/view/${encodeURIComponent(boardId)}`);
    const iframeRef = useRef(null);

    useEffect(() => {
      iframesByWindow.set(windowKey, iframeRef.current);
      return () => iframesByWindow.delete(windowKey);
    }, [windowKey]);

    return (
      <div className="flex flex-col bg-[var(--color-bg-secondary)] h-full">
        <div className="flex-1 relative bg-[var(--color-bg-primary)]">
          <iframe ref={iframeRef} src={viewUrl} className="absolute inset-0 w-full h-full border-0" title="Whiteboard" />
        </div>
      </div>
    );
  }


  host.registerSlot('core.nav.workspace', WhiteboardNavRow);
  host.registerWindow('whiteboard.main', WhiteboardWindowBody);
  // Needs an aw-workspace-ui new enough to expose it (and to render the
  // core.window.titlebar:<id> slot at all) — on an older host this is simply
  // absent, and the window keeps its single header with no app buttons
  // rather than throwing during register().
  host.registerWindowActions?.('whiteboard.main', WhiteboardWindowActions);
}

export default register;
