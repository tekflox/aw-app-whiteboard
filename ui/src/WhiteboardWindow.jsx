import { useState, useRef, useCallback } from 'react';
import { apiFetch } from '../auth';

/**
 * WhiteboardWindow — a floating panel that embeds the persistent, live-synced
 * whiteboard viewer (`/api/apps/whiteboard/view/{id}`). The viewer page owns
 * the websocket subscription, so this component only frames it and adds the
 * save-to-presentation / export / pop-out affordances (mirrors
 * PresentationWindow). Ported verbatim from
 * `aw-frontend/src/components/WhiteboardWindow.jsx` — only the API base
 * paths changed, from the monolith's `/api/whiteboards/*` to this app's own
 * `/api/apps/whiteboard/boards/*` / `/view/*`.
 *
 * `../auth` (apiFetch) is a stand-in import — this file is staged source,
 * not yet wired into a buildable plugin package (see repo README). Once F6d
 * ships, this resolves through the SDK's `sdk.api.fetch` instead.
 */
export default function WhiteboardWindow({ boardId = 'main', windowKey, onClose, onMaximize, isMaximized }) {
  const viewUrl = `/api/apps/whiteboard/view/${encodeURIComponent(boardId)}`;
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
      const res = await apiFetch(`/api/apps/whiteboard/boards/${encodeURIComponent(boardId)}/save_presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setNote(`✓ ${data.action} “${data.presentation_id}”`);
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
  }, [boardId, presId]);

  const handleExport = useCallback(async () => {
    const shell = iframeRef.current;
    if (!shell) return;
    try {
      // The window iframe loads the /view shell, which embeds the board in a
      // nested iframe (#frame). Reach into it to capture the actual board;
      // fall back to the shell document if the nested one isn't reachable.
      const shellDoc = shell.contentDocument;
      const inner = shellDoc?.getElementById('frame');
      const doc = (inner && inner.contentDocument) || shellDoc;
      if (!doc || !doc.body) { setNote('⚠ nada para exportar'); setTimeout(() => setNote(null), 3000); return; }
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(doc.documentElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: doc.documentElement.scrollWidth,
        height: doc.documentElement.scrollHeight,
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
  }, [boardId]);

  return (
    <div className="flex flex-col bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden h-full shadow-2xl shadow-black/40 border border-[var(--color-border)]">
      {/* Header */}
      <div className="drag-handle flex items-center justify-between px-3 py-2 bg-[var(--color-bg-header)] border-b border-[var(--color-border)] select-none cursor-grab active:cursor-grabbing shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">Whiteboard</span>
          {note && <span className="text-[10px] text-[var(--color-text-muted)] truncate">{note}</span>}
        </div>
        <div className="flex items-center gap-1 no-drag" onMouseDown={(e) => e.stopPropagation()}>
          {/* Save to presentation */}
          <div className="relative">
            <button
              onClick={() => { setSaveOpen((v) => !v); setNote(null); }}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Save whiteboard to a presentation"
            >
              <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>
            {saveOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-3"
                style={{ minWidth: 240 }}
                onMouseDown={(e) => e.stopPropagation()}
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
          {/* Export as PNG */}
          <button
            onClick={handleExport}
            className="p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
            title="Export as PNG"
          >
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          {/* Pop out */}
          <button
            onClick={() => window.open(viewUrl, `whiteboard-${boardId}`, 'popup=1,width=1100,height=760')}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Pop out to new window"
          >
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
          {/* Maximize */}
          <button onClick={() => onMaximize?.(windowKey)} className="p-1.5 rounded hover:bg-white/10 transition-colors" title={isMaximized ? 'Restore' : 'Maximize'}>
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
          </button>
          {/* Close */}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Close">
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      {/* Content — live viewer */}
      <div className="flex-1 relative bg-[var(--color-bg-primary)]">
        <iframe
          ref={iframeRef}
          src={viewUrl}
          className="absolute inset-0 w-full h-full border-0"
          title="Whiteboard"
        />
      </div>
    </div>
  );
}
