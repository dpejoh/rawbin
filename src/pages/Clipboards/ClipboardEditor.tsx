import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Clipboard as ClipboardIcon, Copy, Eye, EyeOff, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import RawUrlRow from '../../components/RawUrlRow';
import SaveButton from '../../components/SaveButton';
import { maskContent } from '../../utils/mask';
import { clipboardUrl } from '../../utils/clipboardUrl';
import { decodeContent } from '../../utils/decodeContent';
import SmartJsonEditor from '../../components/SmartJsonEditor';
import type { ClipboardItem } from '../../hooks/useClipboards';

interface ClipboardEditorProps {
  clipboard: ClipboardItem;
  token: string | null;
  role: string;
  onUpdate: (token: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean; useShuffle?: boolean }) => Promise<boolean>;
}

export default function ClipboardEditor({
  clipboard, token, role, onUpdate,
}: ClipboardEditorProps) {
  const [content, setContent] = useState(() => decodeContent(clipboard.content ?? '', clipboard.useBase64 !== false));
  const [useBase64, setUseBase64] = useState(clipboard.useBase64 !== false);
  const [useShuffle, setUseShuffle] = useState(clipboard.useShuffle === true);
  const [savedContent, setSavedContent] = useState(() => decodeContent(clipboard.content ?? '', clipboard.useBase64 !== false));
  const [savedBase64, setSavedBase64] = useState(clipboard.useBase64 !== false);
  const [savedShuffle, setSavedShuffle] = useState(clipboard.useShuffle === true);
  const [name, setName] = useState(clipboard.name);
  const [savedName, setSavedName] = useState(clipboard.name);
  const [slug, setSlug] = useState(clipboard.slug ?? '');
  const [savedSlug, setSavedSlug] = useState(clipboard.slug ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [masked, setMasked] = useState(true);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<'raw' | 'gui'>('raw');

  const isJson = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return false;
    try { JSON.parse(trimmed); return true; }
    catch { return false; }
  }, [content]);

  useEffect(() => {
    const decoded = decodeContent(clipboard.content ?? '', clipboard.useBase64 !== false);
    setContent(decoded);
    setSavedContent(decoded);
    setUseBase64(clipboard.useBase64 !== false);
    setSavedBase64(clipboard.useBase64 !== false);
    setUseShuffle(clipboard.useShuffle === true);
    setSavedShuffle(clipboard.useShuffle === true);
    setName(clipboard.name);
    setSavedName(clipboard.name);
    setSlug(clipboard.slug ?? '');
    setSavedSlug(clipboard.slug ?? '');
    setMode('raw');
    setMasked(true);
    setEditing(false);
  }, [clipboard.id, clipboard.content, clipboard.name, clipboard.slug, clipboard.useBase64]);

  const handleSaveName = useCallback(async () => {
    if (!token || name === savedName) { setIsEditingName(false); return; }
    const ok = await onUpdate(token, clipboard.id, { name });
    if (ok) setSavedName(name);
    else toast.error('Failed to rename');
    setIsEditingName(false);
  }, [token, name, savedName, clipboard.id, onUpdate]);

  const handleSaveSlug = useCallback(async () => {
    if (!token || slug === savedSlug) { setIsEditingSlug(false); return; }
    const ok = await onUpdate(token, clipboard.id, { slug: slug || undefined });
    if (ok) setSavedSlug(slug);
    else toast.error('Failed to update URL');
    setIsEditingSlug(false);
  }, [token, slug, savedSlug, clipboard.id, onUpdate]);

  const handleSaveContent = useCallback(async () => {
    if (!token) return;
    setIsSaving(true);
    const ok = await onUpdate(token, clipboard.id, { content, useBase64, useShuffle });
    if (ok) {
      setSavedContent(content);
      setSavedBase64(useBase64);
      setSavedShuffle(useShuffle);
      toast.success('Saved');
    } else {
      toast.error('Failed to save. Try again.');
    }
    setIsSaving(false);
  }, [token, content, useBase64, useShuffle, clipboard.id, onUpdate]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      setEditing(true);
      setMasked(false);
      const trimmed = text.trim();
      try { JSON.parse(trimmed); setMode('gui'); } catch { setMode('raw'); }
      toast('Pasted from clipboard');
    } catch {
      toast.error('Failed to read clipboard');
    }
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast('Content copied');
    } catch {
      toast.error('Failed to copy');
    }
  }, [content]);

  const handleEdit = useCallback(() => {
    setEditing(true);
    setMasked(false);
    const trimmed = content.trim();
    try { JSON.parse(trimmed); setMode('gui'); } catch { setMode('raw'); }
  }, [content]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setMasked(true);
    setContent(savedContent);
    setUseBase64(savedBase64);
    setUseShuffle(savedShuffle);
    setMode('raw');
  }, [savedContent, savedBase64, savedShuffle]);

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64 || useShuffle !== savedShuffle,
    [content, savedContent, useBase64, savedBase64, useShuffle, savedShuffle]
  );

  const handleModeChange = useCallback((m: string) => {
    const val = m as 'raw' | 'gui';
    if (val === 'gui') {
      try { JSON.parse(content.trim()); }
      catch { toast.error('Invalid JSON — fix syntax before switching to GUI'); return; }
    }
    setMode(val);
  }, [content]);

  const rawUrl = clipboardUrl(clipboard.id, savedSlug || undefined);
  const canonicalUrl = clipboardUrl(clipboard.id);
  const charCount = content.length.toLocaleString();
  const canEditContent = role === 'admin' || (role === 'yuri' && clipboard.slug === 'yuri');

  return (
    <div className="flex-1 p-8 overflow-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0">
          {role === 'admin' && isEditingName ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') { setName(savedName); setIsEditingName(false); }
              }}
              autoFocus
              className="text-xl h-9 font-mono"
            />
          ) : (
            <h1
              className={`text-2xl truncate ${role === 'admin' ? 'cursor-pointer hover:text-primary' : ''}`}
              onClick={() => { if (role === 'admin') setIsEditingName(true); }}
              title="Click to rename"
            >
              {name}
            </h1>
          )}
          <p className="text-sm text-muted-foreground">Board clipboard</p>
        </div>
        {content.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setMasked(!masked); if (!masked) setEditing(false); }}>
            {masked ? <EyeOff className="size-4 mr-1" /> : <Eye className="size-4 mr-1" />}
            {masked ? 'Show' : 'Hide'}
          </Button>
        )}
      </div>

      {/* Raw URL section */}
      <details className="border rounded-lg mb-4 group" open>
        <summary className="px-4 py-2.5 text-xs text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-accent rounded-lg list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="text-[11px]">Raw URL</span>
          <span className="text-[10px] opacity-50 group-open:hidden">▼</span>
          <span className="text-[10px] opacity-50 hidden group-open:inline">▲</span>
        </summary>
        <div className="px-4 pb-4">
          <RawUrlRow url={rawUrl} />
          {savedSlug && canonicalUrl !== rawUrl && (
            <p className="text-xs text-muted-foreground mt-1">
              Also at: {canonicalUrl}
            </p>
          )}
        </div>
      </details>

      {/* Custom slug section */}
      {role === 'admin' && (
        <details className="border rounded-lg mb-4 group">
          <summary className="px-4 py-2.5 text-xs text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-accent rounded-lg list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
            <span className="text-[11px]">Custom URL Slug</span>
            <span className="text-[10px] opacity-50 group-open:hidden">▼</span>
            <span className="text-[10px] opacity-50 hidden group-open:inline">▲</span>
          </summary>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">/clips/</span>
              {isEditingSlug ? (
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  onBlur={handleSaveSlug}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveSlug();
                    if (e.key === 'Escape') { setSlug(savedSlug); setIsEditingSlug(false); }
                  }}
                  autoFocus
                  placeholder="custom-slug"
                  className="w-48 h-8 font-mono text-xs"
                />
              ) : (
                <span
                  className={`text-sm font-mono cursor-pointer hover:underline ${slug ? 'text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setIsEditingSlug(true)}
                >
                  {slug || 'set custom URL...'}
                </span>
              )}
            </div>
          </div>
        </details>
      )}

      {/* Content */}
      <div className="border rounded-lg mb-4">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="text-xs text-muted-foreground">
            {masked && !editing ? '— chars' : `${charCount} characters`}
          </span>
          {editing && isJson && role === 'admin' && (
            <ToggleGroup type="single" value={mode} onValueChange={(v) => { if (v) handleModeChange(v); }}>
              <ToggleGroupItem value="raw" className="text-xs h-7 px-2">Text</ToggleGroupItem>
              <ToggleGroupItem value="gui" className="text-xs h-7 px-2">GUI</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        {!editing && masked && content.length > 0 ? (
          <div className="p-4">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all select-none min-h-20">
              {maskContent(content)}
            </pre>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" onClick={handleEdit}>
                <Eye className="size-4 mr-1" />
                View & Edit
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="size-4 mr-1" />
                Copy
              </Button>
            </div>
          </div>
        ) : isJson && mode === 'gui' && role === 'admin' ? (
          <div className="p-4">
            <SmartJsonEditor value={content} onChange={setContent} />
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start typing…"
              className="min-h-48 font-mono text-base border-0 resize-y focus-visible:ring-1 px-4 py-2"
              readOnly={!canEditContent}
            />
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="size-3.5 mr-1" />
            Copy
          </Button>
          {canEditContent && (
            <Button variant="outline" size="sm" onClick={handlePaste}>
              <ClipboardIcon className="size-3.5 mr-1" />
              Paste
            </Button>
          )}
        </div>
        {canEditContent && (
          <div className="flex items-center gap-3 flex-wrap">
            {editing && (
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Switch checked={useBase64} onCheckedChange={setUseBase64} id="b64" />
                <Label htmlFor="b64" className="text-xs text-muted-foreground cursor-pointer">Base64</Label>
              </div>
              <div className="flex items-center gap-1">
                <Switch checked={useShuffle} onCheckedChange={setUseShuffle} id="shuf" />
                <Label htmlFor="shuf" className="text-xs text-muted-foreground cursor-pointer">randomization</Label>
              </div>
            </div>
            <SaveButton loading={isSaving} hasUnsaved={hasUnsaved} onSave={handleSaveContent} />
          </div>
        )}
      </div>
    </div>
  );
}
