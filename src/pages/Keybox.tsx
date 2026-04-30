import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { snackbar } from 'mdui';
import { useMduiInput, useMduiSwitch } from '../hooks/useMdui';
import RawUrlRow from '../components/RawUrlRow';
import SaveButton from '../components/SaveButton';

interface KeyboxProps {
  token: string | null;
}

const RAW_URL = `${window.location.origin}/key`;

export default function Keybox({ token }: KeyboxProps) {
  const [content,      setContent]      = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [useBase64,    setUseBase64]    = useState(true);
  const [savedBase64,  setSavedBase64]  = useState(true);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSaving,     setIsSaving]     = useState(false);

  const contentRef  = useMduiInput(content, setContent);
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

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64,
    [content, savedContent, useBase64, savedBase64],
  );

  const charCount = useMemo(() => content.length.toLocaleString(), [content]);

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
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

      <mdui-card variant="filled" style={{ padding: 16, marginBottom: 16, display: 'block' }}>
        <p
          className="mdui-typescale-label-small"
          style={{ margin: '0 0 6px', color: 'var(--mdui-color-outline)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Raw URL
        </p>
        <RawUrlRow url={RAW_URL} />
      </mdui-card>

      <mdui-card variant="filled" style={{ padding: 16, marginBottom: 16, display: 'block', maxHeight: 400, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[288, 24, 24].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h }} />
            ))}
          </div>
        ) : (
          <mdui-text-field
            ref={contentRef}
            variant="outlined"
            autosize
            min-rows={12}
            max-rows={20}
            placeholder="Paste your keybox here…"
            style={{ width: '100%', fontFamily: "'Geist Mono', monospace" }}
          />
        )}
      </mdui-card>

      <div className="save-row">
        <p
          className="mdui-typescale-body-small"
          style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
        >
          {charCount} characters
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
