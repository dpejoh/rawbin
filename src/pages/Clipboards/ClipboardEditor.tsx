import { useState, useEffect, useCallback, useMemo } from 'react';
import { snackbar } from 'mdui';
import { useMduiInput, useMduiSwitch } from '../../hooks/useMdui';
import RawUrlRow from '../../components/RawUrlRow';
import SaveButton from '../../components/SaveButton';
import type { Clipboard } from '../../hooks/useClipboards';

function clipboardUrl(id: string, slug?: string): string {
  return `${window.location.origin}${slug ? `/clips/${slug}` : `/clips/${id}`}`;
}

function decodeContent(raw: string, useBase64: boolean): string {
  if (!useBase64) return raw;
  try { return atob(raw); } catch { return raw; }
}

interface ClipboardEditorProps {
  clipboard: Clipboard;
  token: string | null;
  onUpdate: (
    token: string,
    id: string,
    data: { name?: string; content?: string; slug?: string; useBase64?: boolean },
  ) => Promise<boolean>;
}

export default function ClipboardEditor({
  clipboard,
  token,
  onUpdate,
}: ClipboardEditorProps) {
  const initialDecoded = useMemo(
    () => decodeContent(clipboard.content ?? '', clipboard.useBase64 !== false),
    [clipboard.id],
  );

  const [content,      setContent]      = useState(initialDecoded);
  const [useBase64,    setUseBase64]    = useState(clipboard.useBase64 !== false);
  const [savedContent, setSavedContent] = useState(initialDecoded);
  const [savedBase64,  setSavedBase64]  = useState(clipboard.useBase64 !== false);
  const [name,         setName]         = useState(clipboard.name);
  const [savedName,    setSavedName]    = useState(clipboard.name);
  const [slug,         setSlug]         = useState(clipboard.slug ?? '');
  const [savedSlug,    setSavedSlug]    = useState(clipboard.slug ?? '');
  const [editingName,  setEditingName]  = useState(false);
  const [editingSlug,  setEditingSlug]  = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);

  const nameRef     = useMduiInput(name, setName);
  const slugRef     = useMduiInput(slug, setSlug);
  const switchRef   = useMduiSwitch(useBase64, setUseBase64);

  useEffect(() => {
    const decoded = decodeContent(clipboard.content ?? '', clipboard.useBase64 !== false);
    setContent(decoded);       setSavedContent(decoded);
    setUseBase64(clipboard.useBase64 !== false);
    setSavedBase64(clipboard.useBase64 !== false);
    setName(clipboard.name);   setSavedName(clipboard.name);
    setSlug(clipboard.slug ?? '');
    setSavedSlug(clipboard.slug ?? '');
  }, [clipboard.id, clipboard.content, clipboard.name, clipboard.slug, clipboard.useBase64]);

  const saveName = useCallback(async () => {
    if (!token || name === savedName) { setEditingName(false); return; }
    const ok = await onUpdate(token, clipboard.id, { name });
    if (ok) { setSavedName(name); snackbar({ message: 'Renamed', placement: 'bottom', autoCloseDelay: 2000 }); }
    else snackbar({ message: 'Failed to rename', placement: 'bottom', autoCloseDelay: 3000 });
    setEditingName(false);
  }, [token, name, savedName, clipboard.id, onUpdate]);

  const saveSlug = useCallback(async () => {
    if (!token || slug === savedSlug) { setEditingSlug(false); return; }
    const ok = await onUpdate(token, clipboard.id, { slug: slug || undefined });
    if (ok) { setSavedSlug(slug); snackbar({ message: 'Custom URL updated', placement: 'bottom', autoCloseDelay: 2000 }); }
    else snackbar({ message: 'Failed to update URL', placement: 'bottom', autoCloseDelay: 3000 });
    setEditingSlug(false);
  }, [token, slug, savedSlug, clipboard.id, onUpdate]);

  const saveContent = useCallback(async () => {
    if (!token) return;
    setIsSaving(true);
    const ok = await onUpdate(token, clipboard.id, { content, useBase64 });
    if (ok) {
      setSavedContent(content);
      setSavedBase64(useBase64);
      snackbar({ message: 'Saved', placement: 'bottom', autoCloseDelay: 2000 });
    } else {
      snackbar({ message: 'Failed to save. Try again.', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setIsSaving(false);
  }, [token, content, useBase64, clipboard.id, onUpdate]);

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64,
    [content, savedContent, useBase64, savedBase64],
  );

  const rawUrl      = clipboardUrl(clipboard.id, savedSlug || undefined);
  const canonicalUrl = clipboardUrl(clipboard.id);

  return (
    <div className="page" style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        {editingName ? (
          <mdui-text-field
            ref={nameRef}
            variant="outlined"
            autoFocus
            onBlur={saveName}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') { setName(savedName); setEditingName(false); }
            }}
            style={{ width: '100%' }}
          />
        ) : (
          <p
            className="mdui-typescale-headline-small"
            style={{ margin: 0, cursor: 'pointer', color: 'var(--mdui-color-on-surface)' }}
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {name}
          </p>
        )}
      </div>

      <RawUrlRow url={rawUrl} />

      {savedSlug && canonicalUrl !== rawUrl && (
        <p
          className="mdui-typescale-body-small"
          style={{ margin: '8px 0 0', color: 'var(--mdui-color-on-surface-variant)' }}
        >
          Also at: {canonicalUrl}
        </p>
      )}

      <div className="meta-row" style={{ marginTop: 12, marginBottom: 16 }}>
        <span
          className="mdui-typescale-body-small"
          style={{ color: 'var(--mdui-color-on-surface-variant)', whiteSpace: 'nowrap' }}
        >
          Custom URL: /clips/
        </span>
        {editingSlug ? (
          <mdui-text-field
            ref={slugRef}
            variant="outlined"
            placeholder="custom-slug"
            style={{ width: 200 }}
            onBlur={saveSlug}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') saveSlug();
              if (e.key === 'Escape') { setSlug(savedSlug); setEditingSlug(false); }
            }}
          />
        ) : (
          <span
            className="mdui-typescale-body-small"
            style={{
              cursor: 'pointer',
              color: slug ? 'var(--mdui-color-primary)' : 'var(--mdui-color-on-surface-variant)',
              fontFamily: "'Geist Mono', monospace",
            }}
            onClick={() => setEditingSlug(true)}
          >
            {slug || 'set custom URL…'}
          </span>
        )}
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        className="keybox-textarea"
        rows={10}
        placeholder="Start typing…"
        style={{ width: '100%', marginBottom: 16 }}
      />

      <div className="save-row">
        <p
          className="mdui-typescale-body-small"
          style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
        >
          {content.length.toLocaleString()} characters
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <mdui-switch ref={switchRef} />
            <span
              className="mdui-typescale-body-small"
              style={{ color: 'var(--mdui-color-on-surface-variant)' }}
            >
              Base64
            </span>
          </label>
          <SaveButton loading={isSaving} hasUnsaved={hasUnsaved} onSave={saveContent} />
        </div>
      </div>
    </div>
  );
}
