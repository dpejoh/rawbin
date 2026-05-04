import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, TextField, Button, IconButton, Chip, CircularProgress,
  InputAdornment, Checkbox, Box, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AddIcon from '@mui/icons-material/Add';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HistoryIcon from '@mui/icons-material/History';
import GppBadIcon from '@mui/icons-material/GppBad';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useSnackbar } from 'notistack';
import RawUrlRow from '../../components/RawUrlRow';
import { relativeTime } from '../../utils/time';

interface HistoryEntry {
  source: string;
  version: string;
  text: string;
  serial: string;
  revoked: boolean;
  timestamp: string;
}

interface KeyboxManagerProps {
  token: string | null;
}

export default function KeyboxManager({ token }: KeyboxManagerProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addMode, setAddMode] = useState(false);
  const [addSource, setAddSource] = useState('');
  const [addVersion, setAddVersion] = useState('');
  const [addText, setAddText] = useState('');
  const [addContent, setAddContent] = useState('');
  const [addUseBase64, setAddUseBase64] = useState(true);

  const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
  const [xmlItems, setXmlItems] = useState<Array<{ filename: string; content: string; version: string; source: string; text: string }>>([]);
  const [addProviderForIndex, setAddProviderForIndex] = useState<number | null>(null);
  const [newProvider, setNewProvider] = useState('');
  const [addProviderOpen, setAddProviderOpen] = useState(false);

  const [contentCache, setContentCache] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editSource, setEditSource] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editText, setEditText] = useState('');
  const [editUseBase64, setEditUseBase64] = useState(true);
  const [editNewProvider, setEditNewProvider] = useState('');
  const [editAddProviderOpen, setEditAddProviderOpen] = useState(false);
  const [recheckingKey, setRecheckingKey] = useState<string | null>(null);
  const [latestPerSource, setLatestPerSource] = useState<Record<string, string>>({});

  const entryKey = (e: HistoryEntry) => `${e.source}:${e.version}`;

  const nextVersion = (src: string) => {
    const latest = latestPerSource[src];
    if (latest) return String(parseInt(latest, 10) + 1);
    const nums = entries.filter(e => e.source === src).map(e => parseInt(e.version, 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : '1';
  };

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/.netlify/functions/catalog');
      if (res.ok) {
        const data = await res.json() as { entries: HistoryEntry[]; latest: Record<string, string> };
        const list = Array.isArray(data) ? data as HistoryEntry[] : data.entries;
        setEntries(list.sort((a, b) => {
          const na = parseInt(a.version, 10);
          const nb = parseInt(b.version, 10);
          if (!isNaN(na) && !isNaN(nb)) return nb - na;
          return b.timestamp.localeCompare(a.timestamp);
        }));
        const unique = [...new Set(list.map(e => e.source))].sort();
        setSources(unique);
        if (data.latest) setLatestPerSource(data.latest);
      }
    } catch { }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleToggleSelect = useCallback((entry: HistoryEntry) => {
    const key = entryKey(entry);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const loadContent = useCallback(async (key: string) => {
    if (contentCache[key] || loadingContent[key]) return;
    setLoadingContent(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/.netlify/functions/catalog?v=${key}`);
      if (res.ok) {
        const text = await res.text();
        setContentCache(prev => ({ ...prev, [key]: text }));
      }
    } catch { }
    finally { setLoadingContent(prev => ({ ...prev, [key]: false })); }
  }, [contentCache, loadingContent]);

  const handleExpand = useCallback((key: string) => {
    if (expandedKey === key) {
      setExpandedKey(null);
      setEditingKey(null);
    } else {
      setExpandedKey(key);
      setEditingKey(null);
      loadContent(key);
    }
  }, [expandedKey, loadContent]);

  const handleImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !token) return;
    setIsImporting(true);
    const jsonImportData: Array<{ source: string; version: string; content: string; text?: string }> = [];
    const xmlImportItems: Array<{ filename: string; content: string; version: string; text: string }> = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (item.version && item.content && item.source) {
              jsonImportData.push({ source: item.source, version: item.version, content: item.content, text: item.text });
            }
          }
        } else if (file.name.endsWith('.xml')) {
          const vm = file.name.match(/(\d+)/);
          xmlImportItems.push({ filename: file.name, content: text, version: vm && vm[1] ? vm[1] : String(Date.now()), text: vm && vm[1] ? `v${vm[1]}` : '' });
        }
      } catch { }
    }
    let imported = 0;
    if (jsonImportData.length > 0) {
      try {
        const res = await fetch('/.netlify/functions/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(jsonImportData),
        });
        if (res.ok) {
          const result = await res.json() as { imported: number; results: Array<{ source: string; version: string; status: string }> };
          imported = result.results.filter(r => r.status === 'ok').length;
          const skipped = result.results.filter(r => r.status !== 'ok').length;
          if (imported > 0) enqueueSnackbar(`Imported ${imported} keybox${imported !== 1 ? 'es' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`, { variant: 'success' });
        } else enqueueSnackbar('JSON import failed', { variant: 'error' });
      } catch { enqueueSnackbar('JSON import failed', { variant: 'error' }); }
    }
    if (xmlImportItems.length > 0) {
      setXmlItems(xmlImportItems.map(f => ({ ...f, source: '' })));
      setXmlDialogOpen(true);
    }
    if (jsonImportData.length === 0 && xmlImportItems.length === 0) {
      enqueueSnackbar('No valid keyboxes found in selection', { variant: 'error' });
    }
    setIsImporting(false);
    if (imported > 0) {
      setContentCache({});
      await fetchHistory();
    }
  }, [token, fetchHistory, enqueueSnackbar]);

  const handleXmlImport = useCallback(async () => {
    if (!token || xmlItems.length === 0) return;
    const valid = xmlItems.filter(item => item.source && item.text && item.version);
    if (valid.length === 0) {
      enqueueSnackbar('All items need a provider and version', { variant: 'error' });
      return;
    }
    setIsImporting(true);
    try {
      const res = await fetch('/.netlify/functions/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(valid.map(item => ({ source: item.source, version: item.version, text: item.text, content: item.content }))),
      });
      if (res.ok) {
        const result = await res.json() as { imported: number; results: Array<{ source: string; version: string; status: string }> };
        const ok = result.results.filter(r => r.status === 'ok').length;
        const skipped = result.results.filter(r => r.status !== 'ok').length;
        enqueueSnackbar(`Imported ${ok} keybox${ok !== 1 ? 'es' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`, { variant: 'success' });
        setXmlDialogOpen(false);
        setContentCache({});
        await fetchHistory();
      } else enqueueSnackbar('Import failed', { variant: 'error' });
    } catch { enqueueSnackbar('Import failed', { variant: 'error' }); }
    finally { setIsImporting(false); }
  }, [token, xmlItems, fetchHistory, enqueueSnackbar]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); dragCounter.current = 0;
    handleImport(e.dataTransfer.files);
  }, [handleImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const handleDragEnter = useCallback(() => { dragCounter.current++; setDragging(true); }, []);
  const handleDragLeave = useCallback(() => { dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }, []);

  const filtered = entries.filter(e => {
    if (sourceFilter && e.source !== sourceFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return e.version.includes(q) || e.serial.includes(q) || e.source.includes(q);
    }
    return true;
  });

  const handleDelete = useCallback(async (entry: HistoryEntry) => {
    if (!token) return;
    try {
      const res = await fetch('/.netlify/functions/catalog', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: entry.source, version: entry.version }),
      });
      if (res.ok) {
        enqueueSnackbar(`${entry.source} v${entry.version} deleted`, { variant: 'success' });
        const key = entryKey(entry);
        if (expandedKey === key) { setExpandedKey(null); setEditingKey(null); }
        setContentCache(prev => { const n = { ...prev }; delete n[key]; return n; });
        await fetchHistory();
      } else enqueueSnackbar('Delete failed', { variant: 'error' });
    } catch { enqueueSnackbar('Delete failed', { variant: 'error' }); }
  }, [token, fetchHistory, expandedKey, enqueueSnackbar]);

  const handleRecheck = useCallback(async (entry: HistoryEntry) => {
    if (!token) return;
    const key = entryKey(entry);
    setRecheckingKey(key);
    try {
      const res = await fetch(`/.netlify/functions/catalog?recheck=${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        enqueueSnackbar(`${entry.source} v${entry.version} re-checked`, { variant: 'success' });
        setContentCache({});
        await fetchHistory();
      } else enqueueSnackbar('Re-check failed', { variant: 'error' });
    } catch { enqueueSnackbar('Re-check failed', { variant: 'error' }); }
    finally { setRecheckingKey(null); }
  }, [token, fetchHistory, enqueueSnackbar]);

  const handleAddSave = useCallback(async () => {
    if (!token || !addSource || !addVersion || !addContent) return;
    try {
      const res = await fetch('/.netlify/functions/catalog/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: addSource, version: addVersion, text: addText, content: addContent, useBase64: addUseBase64 }),
      });
      if (res.ok) {
        enqueueSnackbar('Keybox added', { variant: 'success' });
        setAddMode(false);
        setAddSource('');
        setAddVersion('');
        setAddText('');
        setAddContent('');
        setAddUseBase64(true);
        setContentCache({});
        await fetchHistory();
      } else {
        const msg = await res.text().catch(() => 'Failed to add');
        enqueueSnackbar(msg, { variant: 'error' });
      }
    } catch { enqueueSnackbar('Failed to add', { variant: 'error' }); }
  }, [token, addSource, addVersion, addContent, fetchHistory, enqueueSnackbar]);

  const handleStartEdit = useCallback((entry: HistoryEntry) => {
    const key = entryKey(entry);
    setEditingKey(key);
    setEditSource(entry.source);
    setEditVersion(entry.version);
    setEditText(entry.text || '');
    setEditContent(contentCache[key] ?? '');
    setEditUseBase64(true);
  }, [contentCache]);

  const handleEditSave = useCallback(async (entry: HistoryEntry) => {
    if (!token || !editSource || !editVersion || !editContent) return;
    const key = entryKey(entry);
    const srcChanged = editSource !== entry.source;
    const verChanged = editVersion !== entry.version;
    try {
      if (srcChanged || verChanged) {
        const delRes = await fetch('/.netlify/functions/catalog', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ source: entry.source, version: entry.version }),
        });
        if (!delRes.ok) { enqueueSnackbar('Failed to replace old entry', { variant: 'error' }); return; }
        setContentCache(prev => { const n = { ...prev }; delete n[key]; return n; });
      }
      const saveRes = await fetch('/.netlify/functions/catalog/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: editSource, version: editVersion, text: editText, content: editContent, useBase64: editUseBase64 }),
      });
      if (saveRes.ok) {
        enqueueSnackbar('Entry updated', { variant: 'success' });
        setEditingKey(null);
        setContentCache(prev => {
          const n = { ...prev };
          delete n[key];
          n[`${editSource}:${editVersion}`] = editContent;
          return n;
        });
        setExpandedKey(`${editSource}:${editVersion}`);
        await fetchHistory();
      } else enqueueSnackbar('Failed to save entry', { variant: 'error' });
    } catch { enqueueSnackbar('Failed to save entry', { variant: 'error' }); }
  }, [token, editSource, editVersion, editContent, fetchHistory, enqueueSnackbar]);

  return (
    <Box sx={{ p: 4, maxWidth: 800, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Keyboxes</Typography>
          <Typography variant="body2" color="text.secondary">
            {entries.length} keybox{entries.length !== 1 ? 'es' : ''}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{
        border: `2px dashed ${dragging ? 'var(--mdui-color-primary, #A8C7FA)' : 'var(--mdui-color-outline, #8E9099)'}`,
        borderRadius: '12px', p: 2, mb: 2, textAlign: 'center', cursor: 'pointer',
        transition: 'border-color 150ms, background 150ms',
        bgcolor: dragging ? 'rgba(168,199,250,0.05)' : 'transparent',
      }}
        onDrop={handleDrop} onDragOver={handleDragOver}
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
        <Typography variant="body2">{isImporting ? 'Importing...' : 'Drop XML or JSON files here'}</Typography>
        <input ref={fileInputRef} type="file" accept=".xml,.json" multiple style={{ display: 'none' }}
          onChange={e => handleImport(e.target.files)} />
        {isImporting && <CircularProgress size={20} sx={{ mt: 0.5 }} />}
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setAddMode(!addMode); if (!addMode) { setExpandedKey(null); setEditingKey(null); } }}
          sx={{ textTransform: 'none' }}>
          {addMode ? 'Cancel' : 'Add Keybox'}
        </Button>
      </Stack>

      {addMode && (
        <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'surfaceContainer.main' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Add Keybox</Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Select
                value={addSource}
                onChange={(e) => {
                  if (e.target.value === '__add__') setAddProviderOpen(true);
                  else {
                    setAddSource(e.target.value);
                    setAddVersion(nextVersion(e.target.value));
                  }
                }}
                size="small" displayEmpty sx={{ minWidth: 160 }}
                renderValue={(v) => v || 'Select provider'}
              >
                {sources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                <MenuItem value="__add__" sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 1, color: 'primary.main', fontWeight: 500 }}>
                  ✚ Add provider
                </MenuItem>
              </Select>
              <TextField label="Text" size="small" type="text" sx={{ width: 240 }}
                value={addText} onChange={(e) => setAddText(e.target.value)} />
            </Stack>
            <TextField
              multiline minRows={8} fullWidth
              placeholder="Paste keybox XML content here..."
              value={addContent} onChange={(e) => setAddContent(e.target.value)}
              inputProps={{ spellCheck: false }}
              sx={{ '& .MuiInputBase-root': { fontFamily: '"Geist Mono", monospace', fontSize: 13 } }}
            />
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Switch checked={addUseBase64} onChange={(e) => setAddUseBase64(e.target.checked)} size="small" />
              <Typography variant="body2" color="text.secondary">Base64</Typography>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="text" onClick={() => { setAddMode(false); setAddSource(''); setAddVersion(''); setAddText(''); setAddContent(''); }}>Cancel</Button>
              <Button variant="contained" onClick={handleAddSave} disabled={!addSource || !addText || !addContent}>Save</Button>
            </Stack>
          </Stack>
        </Box>
      )}

      <Dialog open={addProviderOpen} onClose={() => setAddProviderOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Provider</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth placeholder="e.g. droidwin" value={newProvider}
            onChange={(e) => setNewProvider(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newProvider.trim()) {
                setAddSource(newProvider.trim());
                setNewProvider('');
                setAddProviderOpen(false);
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddProviderOpen(false)}>Cancel</Button>
          <Button onClick={() => {
            if (newProvider.trim()) {
              setAddSource(newProvider.trim());
              setNewProvider('');
              setAddProviderOpen(false);
            }
          }}>Add</Button>
        </DialogActions>
      </Dialog>

      <Box display="flex" sx={{ gap: '6px', mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip label="All" size="small" variant={sourceFilter === null ? 'filled' : 'outlined'}
          onClick={() => setSourceFilter(null)} color={sourceFilter === null ? 'primary' : 'default'} />
        {sources.map(s => (
          <Chip key={s} label={s} size="small" variant={sourceFilter === s ? 'filled' : 'outlined'}
            onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
            color={sourceFilter === s ? 'primary' : 'default'} />
        ))}
        <Box sx={{ flex: 1 }} />
        <Chip
          label={selectMode ? `${selectedIds.size} selected` : 'Select'}
          size="small"
          variant={selectMode ? 'filled' : 'outlined'}
          color={selectMode ? 'primary' : 'default'}
          onClick={() => { if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); } else setSelectMode(true); }}
          sx={{ cursor: 'pointer' }}
        />
        {selectMode && (
          <Button variant="text" size="small"
            onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
            sx={{ textTransform: 'none', minWidth: 'auto', fontSize: 12, height: 24 }}>
            Cancel
          </Button>
        )}
        {selectMode && selectedIds.size > 0 && (
          <Button variant="contained" color="error" size="small" startIcon={<DeleteSweepIcon />}
            onClick={async () => {
              if (!token || selectedIds.size === 0) return;
              setIsDeleting(true);
              let ok = 0; let fail = 0;
              for (const entry of entries.filter(e => selectedIds.has(`${e.source}:${e.version}`))) {
                try {
                  const res = await fetch('/.netlify/functions/catalog', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ source: entry.source, version: entry.version }),
                  });
                  if (res.ok) ok++; else fail++;
                } catch { fail++; }
              }
              enqueueSnackbar(`Deleted ${ok} entry${ok !== 1 ? 'es' : ''}${fail > 0 ? ` (${fail} failed)` : ''}`, { variant: fail === 0 ? 'success' : 'error' });
              setSelectedIds(new Set());
              setSelectMode(false);
              setIsDeleting(false);
              setContentCache({});
              await fetchHistory();
            }}
            disabled={isDeleting}
            sx={{ textTransform: 'none', height: 24 }}>
            {isDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
          </Button>
        )}
      </Box>

      <TextField variant="filled" fullWidth placeholder="Search by version, serial, or source..."
        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2, '& .MuiInputBase-input': { fontFamily: '"Geist Mono", monospace' } }}
        InputProps={{
          endAdornment: searchQuery ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchQuery('')}><CloseIcon fontSize="small" /></IconButton>
            </InputAdornment>
          ) : undefined,
        }}
      />

      {isLoading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3, 4].map(i => <Box key={i} className="skeleton" sx={{ height: 72, borderRadius: '8px' }} />)}
        </Stack>
      ) : filtered.length === 0 ? (
        <Box className="empty-state" sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', p: '64px 24px', textAlign: 'center' }}>
          <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6">{searchQuery || sourceFilter ? 'No matching keyboxes' : (addMode ? 'Add a keybox above' : 'No keyboxes yet')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery || sourceFilter ? 'Try a different search term or filter' : 'Import keyboxes or use Add Keybox to get started'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(entry => {
            const key = entryKey(entry);
            const isSelected = selectedIds.has(key);
            const isExpanded = expandedKey === key;
            const isEditing = editingKey === key;
            const cachedContent = contentCache[key];
            const isLoadingContent = loadingContent[key];
            const isRechecking = recheckingKey === key;
            return (
              <Box key={key}>
                <Box
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.MuiCheckbox-root')) return;
                    if ((e.target as HTMLElement).closest('button')) return;
                    handleExpand(key);
                  }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    p: '12px 16px', borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                    bgcolor: isSelected ? 'rgba(168,199,250,0.12)' : 'surfaceContainer.main',
                    cursor: 'pointer', transition: 'background 150ms',
                    '&:hover': { bgcolor: 'surfaceContainerHigh.main' },
                  }}
                >
                  <Box sx={{ width: 36, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                    {selectMode && (
                      <Checkbox checked={isSelected} onChange={() => handleToggleSelect(entry)} size="small" sx={{ p: 0.5 }} />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>{entry.source}</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{entry.text || entry.version}</Typography>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FingerprintIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                        <Typography variant="caption" sx={{ fontFamily: '"Geist Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.serial}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">{relativeTime(entry.timestamp)}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <Chip icon={entry.revoked ? <GppBadIcon /> : <VerifiedUserIcon />}
                      label={entry.revoked ? 'Revoked' : 'Active'} size="small"
                      sx={{ color: entry.revoked ? 'error.main' : 'success.main', '& .MuiChip-icon': { color: entry.revoked ? 'error.main' : 'success.main' } }}
                    />
                    {isExpanded ? <ExpandLessIcon sx={{ color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                  </Box>
                </Box>
                {isExpanded && (
                  <Box sx={{
                    p: '12px 16px', borderRadius: '0 0 8px 8px',
                    bgcolor: 'surfaceContainer.main',
                    borderTop: '1px solid var(--mdui-color-outline-variant, #44474F)',
                  }}>
                    {isEditing ? (
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Select
                            value={editSource}
                            onChange={(e) => {
                              if (e.target.value === '__add__') setEditAddProviderOpen(true);
                              else setEditSource(e.target.value);
                            }}
                            size="small" displayEmpty sx={{ minWidth: 160 }}
                          >
                            {sources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                            <MenuItem value="__add__" sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 1, color: 'primary.main', fontWeight: 500 }}>
                              ✚ Add provider
                            </MenuItem>
                          </Select>
                          <TextField label="Text" size="small" type="text" sx={{ width: 240 }}
                            value={editText} onChange={(e) => setEditText(e.target.value)} />
                        </Stack>
                        <TextField multiline minRows={8} fullWidth
                          value={editContent} onChange={(e) => setEditContent(e.target.value)}
                          inputProps={{ spellCheck: false }}
                          sx={{ '& .MuiInputBase-root': { fontFamily: '"Geist Mono", monospace', fontSize: 13 } }} />
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Switch checked={editUseBase64} onChange={(e) => setEditUseBase64(e.target.checked)} size="small" />
                          <Typography variant="body2" color="text.secondary">Base64</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" onClick={() => setEditingKey(null)}>Cancel</Button>
                          <Button size="small" variant="contained" onClick={() => handleEditSave(entry)} disabled={!editSource || !editText || !editContent}>Save</Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <>
                        <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Text</Typography>
                          <Typography variant="caption">{entry.text || entry.version}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Source</Typography>
                          <Typography variant="caption">{entry.source}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Version</Typography>
                          <Typography variant="caption">{entry.version}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Serial</Typography>
                          <Typography variant="caption" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, wordBreak: 'break-all', ml: 2 }}>{entry.serial}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Date</Typography>
                          <Typography variant="caption">{new Date(entry.timestamp).toLocaleString()}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Chip icon={entry.revoked ? <GppBadIcon /> : <VerifiedUserIcon />}
                            label={entry.revoked ? 'Revoked' : 'Active'} size="small"
                            sx={{ color: entry.revoked ? 'error.main' : 'success.main', '& .MuiChip-icon': { color: entry.revoked ? 'error.main' : 'success.main' } }} />
                        </Stack>
                        <Box sx={{ mt: 1 }}>
                          <RawUrlRow url={`${window.location.origin}/key/${entry.source}/${entry.version}`} />
                        </Box>
                        {isLoadingContent ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={20} /></Box>
                        ) : cachedContent && (
                          <Box sx={{ mt: 1 }}>
                            <TextField multiline minRows={4} maxRows={12} fullWidth
                              value={cachedContent}
                              inputProps={{ readOnly: true, spellCheck: false }}
                              sx={{ '& .MuiInputBase-root': { fontFamily: '"Geist Mono", monospace', fontSize: 12 } }} />
                          </Box>
                        )}
                        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                          <Button variant="outlined" size="small" startIcon={<EditIcon />}
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(entry); }} sx={{ textTransform: 'none' }}>
                            Edit
                          </Button>
                          <Button variant="outlined" size="small" startIcon={<AutorenewIcon />}
                            onClick={(e) => { e.stopPropagation(); handleRecheck(entry); }} disabled={isRechecking} sx={{ textTransform: 'none' }}>
                            {isRechecking ? 'Checking...' : 'Re-check'}
                          </Button>
                          <Button variant="outlined" size="small" startIcon={<DeleteIcon />} color="error"
                            onClick={(e) => { e.stopPropagation(); handleDelete(entry); }} sx={{ textTransform: 'none' }}>
                            Delete
                          </Button>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Dialog open={xmlDialogOpen} onClose={() => setXmlDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import XML Keyboxes</DialogTitle>
        <DialogContent>
          {xmlItems.map((item, i) => (
            <Box key={i} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{item.filename}</Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Select value={item.source}
                    onChange={(e) => {
                      if (e.target.value === '__add__') setAddProviderForIndex(i);
                      else setXmlItems(prev => prev.map((x, j) => j === i ? { ...x, source: e.target.value } : x));
                    }}
                    size="small" displayEmpty sx={{ minWidth: 160 }}
                    renderValue={(v) => v || 'Select provider'}
                  >
                    {sources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    <MenuItem value="__add__" sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 1, color: 'primary.main', fontWeight: 500 }}>
                      ✚ Add provider
                    </MenuItem>
                  </Select>
                  <TextField label="Text" size="small" type="text" sx={{ width: 160 }}
                    value={item.text}
                    onChange={(e) => setXmlItems(prev => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                </Stack>
              </Stack>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setXmlDialogOpen(false); setXmlItems([]); }}>Cancel</Button>
          <Button variant="contained" onClick={handleXmlImport} disabled={isImporting}>
            {isImporting ? 'Importing...' : `Import ${xmlItems.length} file${xmlItems.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addProviderForIndex !== null} onClose={() => setAddProviderForIndex(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Provider</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth placeholder="e.g. droidwin" value={newProvider}
            onChange={(e) => setNewProvider(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addProviderForIndex !== null && newProvider.trim()) {
                setXmlItems(prev => prev.map((x, j) => j === addProviderForIndex ? { ...x, source: newProvider.trim() } : x));
                setAddProviderForIndex(null);
                setNewProvider('');
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddProviderForIndex(null)}>Cancel</Button>
          <Button onClick={() => {
            if (addProviderForIndex !== null && newProvider.trim()) {
              setXmlItems(prev => prev.map((x, j) => j === addProviderForIndex ? { ...x, source: newProvider.trim() } : x));
              setAddProviderForIndex(null);
              setNewProvider('');
            }
          }}>Add</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editAddProviderOpen} onClose={() => setEditAddProviderOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Provider</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth placeholder="e.g. droidwin" value={editNewProvider}
            onChange={(e) => setEditNewProvider(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editNewProvider.trim()) {
                setEditSource(editNewProvider.trim());
                setEditNewProvider('');
                setEditAddProviderOpen(false);
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAddProviderOpen(false)}>Cancel</Button>
          <Button onClick={() => {
            if (editNewProvider.trim()) {
              setEditSource(editNewProvider.trim());
              setEditNewProvider('');
              setEditAddProviderOpen(false);
            }
          }}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
