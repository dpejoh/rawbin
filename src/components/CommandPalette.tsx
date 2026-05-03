import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog,
  TextField,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderIcon from '@mui/icons-material/Folder';

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

  function iconForType(type: PaletteItem['type']) {
    switch (type) {
      case 'keybox': return <KeyIcon />;
      case 'clipboard': return <DescriptionIcon />;
      case 'file': return <FolderIcon />;
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => { setOpen(false); setQuery(''); }}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <div style={{ padding: '16px 16px 0' }}>
        <TextField
          variant="filled"
          fullWidth
          placeholder="Search clipboards, files, pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          sx={{ '& .MuiInputBase-input': { fontFamily: '"Geist Mono", monospace' } }}
        />
      </div>
      {filtered.length > 0 && (
        <List sx={{ maxHeight: 320, overflowY: 'auto', pt: 1 }} dense>
          {filtered.map((item, i) => (
            <ListItemButton
              key={item.id}
              selected={i === selectedIdx}
              onClick={() => handleSelect(item)}
              sx={{
                borderRadius: 1,
                mx: 1,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: '#0842A0',
                  '& .MuiListItemIcon-root': { color: '#0842A0' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {iconForType(item.type)}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.description}
                primaryTypographyProps={{ variant: 'subtitle1', noWrap: true }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
      {query.trim() && filtered.length === 0 && (
        <Typography
          variant="body2"
          sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}
        >
          No results for "{query}"
        </Typography>
      )}
    </Dialog>
  );
}
