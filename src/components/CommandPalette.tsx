import { useState, useEffect, useCallback, useMemo } from 'react';
import { Key, FileText, Folder } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import type { Page } from '../App';

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  type: 'keybox' | 'clipboard' | 'file';
  page: Page;
}

interface CommandPaletteProps {
  token: string | null;
  onNavigate: (page: Page) => void;
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

const typeIcons: Record<PaletteItem['type'], React.ReactNode> = {
  keybox: <Key className="size-4" />,
  clipboard: <FileText className="size-4" />,
  file: <Folder className="size-4" />,
};

export default function CommandPalette({ token, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PaletteItem[]>([]);

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
    if (!token) return;

    const abortController = new AbortController();

    async function load() {
      const result: PaletteItem[] = [
        {
          id: 'keybox-page',
          label: 'Keyboxes',
          description: 'Manage keybox versions',
          type: 'keybox',
          page: 'keybox',
        },
      ];
      try {
        const [clipRes, fileRes] = await Promise.all([
          fetch('/api/clipboards', {
            signal: abortController.signal,
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/files', {
            signal: abortController.signal,
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
      if (!abortController.signal.aborted) {
        setItems(result);
      }
    }
    load();
    return () => abortController.abort();
  }, [open, token]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim();
    return items.filter(item =>
      fuzzyMatch(item.label, q) || fuzzyMatch(item.description, q)
    );
  }, [items, query]);

  const handleSelect = useCallback((item: PaletteItem) => {
    onNavigate(item.page);
    setOpen(false);
    setQuery('');
  }, [onNavigate]);

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}>
      <CommandInput
        placeholder="Search clipboards, files, pages…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results for "{query}"</CommandEmpty>
        <CommandGroup>
          {filtered.map((item) => (
            <CommandItem
              key={item.id}
              value={item.id}
              onSelect={() => handleSelect(item)}
            >
              {typeIcons[item.type]}
              <div className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
