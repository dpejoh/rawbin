import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMduiDialog, useMduiInput } from '../hooks/useMdui';

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  type: 'keybox' | 'clipboard' | 'file';
  page: string;
}

interface CommandPaletteProps {
  token: string | null;
  onNavigate: (page: string) => void;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export default function CommandPalette({ token, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const fetchingRef = useRef(false);

  const dialogRef = useMduiDialog(open, () => { setOpen(false); setQuery(''); });
  const searchRef = useMduiInput(query, setQuery);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIdx(0);
    if (!token || fetchingRef.current) return;
    fetchingRef.current = true;
    async function load() {
      const result: PaletteItem[] = [];
      result.push({
        id: 'keybox-page',
        label: 'Keybox',
        description: 'Your private key store',
        type: 'keybox',
        page: 'keybox',
      });
      try {
        const [clipRes, fileRes] = await Promise.all([
          fetch('/.netlify/functions/clipboards', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/.netlify/functions/files', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (clipRes.ok) {
          const clips = await clipRes.json() as { id: string; name: string; content?: string }[];
          for (const c of clips) {
            result.push({
              id: `clip-${c.id}`,
              label: c.name,
              description: `${(c.content ?? '').length.toLocaleString()} chars · clipboard`,
              type: 'clipboard',
              page: 'clipboards',
            });
          }
        }
        if (fileRes.ok) {
          const files = await fileRes.json() as { id: string; name: string; isFolder?: boolean }[];
          for (const f of files) {
            result.push({
              id: `file-${f.id}`,
              label: f.name,
              description: f.isFolder ? 'folder' : 'file',
              type: 'file',
              page: 'files',
            });
          }
        }
      } catch { /* silent */ }
      setItems(result);
      fetchingRef.current = false;
    }
    load();
  }, [open, token]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim();
    return items.filter(item =>
      fuzzyMatch(item.label, q) || fuzzyMatch(item.description, q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleSelect = useCallback((item: PaletteItem) => {
    onNavigate(item.page);
    setOpen(false);
    setQuery('');
  }, [onNavigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      handleSelect(filtered[selectedIdx]!);
    }
  }, [filtered, selectedIdx, handleSelect]);

  return (
    <mdui-dialog
      ref={dialogRef}
      close-on-overlay-click
      close-on-esc
      style={{ width: 480, maxWidth: '90vw' }}
    >
      <div style={{ padding: 0 }}>
        <mdui-text-field
          ref={searchRef}
          variant="filled"
          placeholder="Search clipboards, files, pages…"
          style={{ width: '100%' }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {filtered.length > 0 && (
        <mdui-list style={{ maxHeight: 320, overflowY: 'auto', marginTop: 8 }}>
          {filtered.map((item, i) => (
            <mdui-list-item
              key={item.id}
              icon={item.type === 'keybox' ? 'vpn_key' : item.type === 'clipboard' ? 'description' : 'folder'}
              rounded
              active={i === selectedIdx}
              onClick={() => handleSelect(item)}
              style={
                i === selectedIdx
                  ? { background: 'var(--mdui-color-primary-container)', color: 'var(--mdui-color-on-primary-container)' }
                  : undefined
              }
            >
              {item.label}
              <span slot="description">{item.description}</span>
            </mdui-list-item>
          ))}
        </mdui-list>
      )}
      {query.trim() && filtered.length === 0 && (
        <p
          className="mdui-typescale-body-medium"
          style={{ textAlign: 'center', padding: 24, color: 'var(--mdui-color-on-surface-variant)', margin: 0 }}
        >
          No results for "{query}"
        </p>
      )}
    </mdui-dialog>
  );
}
