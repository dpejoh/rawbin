import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { snackbar } from 'mdui';
import { useMduiSwitch } from '../hooks/useMdui';
import RawUrlRow from '../components/RawUrlRow';
import SaveButton from '../components/SaveButton';

interface KeyboxProps {
  token: string | null;
}

const RAW_URL = `${window.location.origin}/key`;

function maskContent(text: string): string {
  if (!text) return '';
  if (text.length <= 16) return '\u2022'.repeat(text.length);
  const first = text.slice(0, 8);
  const last = text.slice(-8);
  const dots = '\u2022'.repeat(Math.min(text.length - 16, 64));
  return first + dots + '\n' + '\u2022'.repeat(Math.min(text.length, 32)) + '\n' + last;
}

function countLines(s: string): number {
  let n = 1;
  for (let i = 0; i < s.length; i++) if (s[i] === '\n') n++;
  return n;
}

export default function Keybox({ token }: KeyboxProps) {
  const [content,      setContent]      = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [useBase64,    setUseBase64]    = useState(true);
  const [savedBase64,  setSavedBase64]  = useState(true);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSaving,     setIsSaving]     = useState(false);
  const [masked,       setMasked]       = useState(true);
  const [revealed,     setRevealed]     = useState(false);
  const [editing,      setEditing]      = useState(false);
  const revealTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const switchRef   = useMduiSwitch(useBase64, setUseBase64);
  const pasteRef = useRef<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const [contentRes, metaRes] = await Promise.all([
          fetch(RAW_URL),
          fetch(`${RAW_URL}?meta`),
        ]);
        if (contentRes.ok) {
          const text = await contentRes.text();
          let meta = { useBase64: true };
          try {
            if (metaRes.ok) meta = JSON.parse(await metaRes.text()) as { useBase64: boolean };
          } catch { /* ignore */ }
          const decoded = meta.useBase64 ? atob(text) : text;
          setContent(decoded);
          setSavedContent(decoded);
          setUseBase64(meta.useBase64);
          setSavedBase64(meta.useBase64);
        }
      } catch { /* no content yet */ }
      finally { setIsLoading(false); }
    }
    load();
  }, []);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch('/.netlify/functions/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, useBase64 }),
      });
      if (res.ok) {
        setSavedContent(content);
        setSavedBase64(useBase64);
        snackbar({ message: 'Keybox saved', placement: 'bottom', autoCloseDelay: 2500 });
      } else {
        snackbar({ message: 'Failed to save. Try again.', placement: 'bottom', autoCloseDelay: 3000 });
      }
    } catch {
      snackbar({ message: 'Failed to save. Try again.', placement: 'bottom', autoCloseDelay: 3000 });
    } finally {
      setIsSaving(false);
    }
  }, [token, content, useBase64]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      setEditing(true);
      setMasked(false);
      snackbar({ message: 'Pasted from clipboard', placement: 'bottom', autoCloseDelay: 2000 });
    } catch {
      snackbar({ message: 'Failed to read clipboard', placement: 'bottom', autoCloseDelay: 2500 });
    }
  }, []);

  useEffect(() => {
    const el = pasteRef.current;
    if (!el) return;
    el.addEventListener('click', handlePaste);
    return () => el.removeEventListener('click', handlePaste);
  }, [handlePaste]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      snackbar({ message: 'Content copied', placement: 'bottom', autoCloseDelay: 2000 });
    } catch {
      snackbar({ message: 'Failed to copy', placement: 'bottom', autoCloseDelay: 2500 });
    }
  }, [content]);

  const handleRevealStart = useCallback(() => {
    if (revealTimeout.current) clearTimeout(revealTimeout.current);
    setRevealed(true);
  }, []);

  const handleRevealEnd = useCallback(() => {
    revealTimeout.current = setTimeout(() => setRevealed(false), 300);
  }, []);

  const handleEdit = useCallback(() => {
    setEditing(true);
    setMasked(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setMasked(true);
    setContent(savedContent);
  }, [savedContent]);

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64,
    [content, savedContent, useBase64, savedBase64],
  );

  const charCount = useMemo(() => content.length.toLocaleString(), [content]);

  const showPreview = !editing && masked && content.length > 0;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p className="mdui-typescale-headline-medium" style={{ margin: '0 0 4px' }}>
            Keybox
          </p>
          <p
            className="mdui-typescale-body-medium"
            style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
          >
            Your private keybox.{' '}
            {useBase64 ? 'Stored as base64.' : 'Stored as plain text.'}
          </p>
        </div>
        {content.length > 0 && (
          <mdui-button
            variant="text"
            icon={masked ? 'visibility' : 'visibility_off'}
            onClick={() => { setMasked(!masked); setEditing(false); setRevealed(false); }}
            style={{ flexShrink: 0 }}
          >
            {masked ? 'Show' : 'Hide'}
          </mdui-button>
        )}
      </div>

      <mdui-card variant="filled" style={{ padding: 16, marginBottom: 16, display: 'block' }}>
        <p
          className="mdui-typescale-label-small"
          style={{ margin: '0 0 6px', color: 'var(--mdui-color-outline)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Raw URL
        </p>
        <RawUrlRow url={RAW_URL} />
      </mdui-card>

      {isLoading ? (
        <mdui-card variant="filled" style={{ padding: 16, marginBottom: 16, display: 'block', maxHeight: 400, overflow: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[288, 24, 24].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h }} />
            ))}
          </div>
        </mdui-card>
      ) : showPreview ? (
        <mdui-card variant="filled" style={{ padding: 16, marginBottom: 16, display: 'block' }}>
          <pre
            className="keybox-masked"
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 'var(--mdui-typescale-body-small-size)',
              color: revealed ? 'var(--mdui-color-on-surface)' : 'var(--mdui-color-outline)',
              lineHeight: 1.6,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              minHeight: 80,
              userSelect: revealed ? 'text' : 'none',
            }}
          >
            {revealed ? content : maskContent(content)}
          </pre>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <mdui-button
              variant="tonal"
              icon="visibility"
              onMouseDown={handleRevealStart}
              onMouseUp={handleRevealEnd}
              onMouseLeave={handleRevealEnd}
              onTouchStart={handleRevealStart}
              onTouchEnd={handleRevealEnd}
            >
              {revealed ? 'Release to hide' : 'Hold to reveal'}
            </mdui-button>
            <mdui-button
              variant="outlined"
              icon="content_copy"
              onClick={handleCopy}
            >
              Copy
            </mdui-button>
            <mdui-button
              variant="outlined"
              icon="edit"
              onClick={handleEdit}
            >
              Edit
            </mdui-button>
          </div>
        </mdui-card>
      ) : (
        <mdui-card variant="filled" style={{ padding: 16, marginBottom: 16, display: 'block', maxHeight: 400, overflow: 'auto' }}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="keybox-textarea"
            rows={12}
            placeholder="Paste your keybox here…"
          />
        </mdui-card>
      )}

      <div className="save-row">
        <p
          className="mdui-typescale-body-small"
          style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
        >
          {charCount} characters
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editing && (
            <mdui-button
              variant="text"
              onClick={handleCancelEdit}
            >
              Cancel
            </mdui-button>
          )}
          <mdui-button
            ref={pasteRef}
            variant="outlined"
            icon="content_paste"
          >
            Paste
          </mdui-button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <mdui-switch ref={switchRef} />
            <span
              className="mdui-typescale-body-small"
              style={{ color: 'var(--mdui-color-on-surface-variant)' }}
            >
              Base64
            </span>
          </label>
          <SaveButton
            loading={isSaving}
            hasUnsaved={hasUnsaved}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
