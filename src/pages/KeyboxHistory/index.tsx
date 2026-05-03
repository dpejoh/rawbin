import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, TextField, Button, IconButton, Chip, CircularProgress,
  InputAdornment, Checkbox, Box, Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HistoryIcon from '@mui/icons-material/History';
import GppBadIcon from '@mui/icons-material/GppBad';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useSnackbar } from 'notistack';
import RawUrlRow from '../../components/RawUrlRow';
import { relativeTime } from '../../utils/time';

interface HistoryEntry {
  source: string;
  version: string;
  serial: string;
  revoked: boolean;
  timestamp: string;
}

interface KeyboxHistoryProps {
  token: string | null;
}

export default function KeyboxHistory({ token }: KeyboxHistoryProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/.netlify/functions/catalog');
      if (res.ok) {
        const data = await res.json() as { entries: HistoryEntry[] };
        const list = Array.isArray(data) ? data as HistoryEntry[] : data.entries;
        setEntries(list.sort((a, b) => {
          const na = parseInt(a.version, 10);
          const nb = parseInt(b.version, 10);
          if (!isNaN(na) && !isNaN(nb)) return nb - na;
          return b.timestamp.localeCompare(a.timestamp);
        }));
        const unique = [...new Set(list.map(e => e.source))].sort();
        setSources(unique);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const entryKey = (e: HistoryEntry) => `${e.source}:${e.version}`;

  const handleToggleSelect = useCallback((entry: HistoryEntry) => {
    const key = entryKey(entry);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !token) return;
    setIsImporting(true);
    const importData: Array<{ source?: string; version: string; content: string }> = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) importData.push(...parsed);
          else if (parsed.version && parsed.content) importData.push({ source: parsed.source || 'yuri', version: parsed.version, content: parsed.content });
        } else {
          const vm = file.name.match(/(\d+)/);
          importData.push({ source: 'yuri', version: vm && vm[1] ? vm[1] : String(Date.now()), content: text });
        }
      } catch { /* skip */ }
    }
    if (importData.length === 0) {
      enqueueSnackbar('No valid keyboxes found in selection', { variant: 'error' });
      setIsImporting(false); return;
    }
    try {
      const res = await fetch('/.netlify/functions/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(importData),
      });
      if (res.ok) {
        const result = await res.json() as { imported: number; results: Array<{ source: string; version: string; status: string }> };
        const ok = result.results.filter(r => r.status === 'ok').length;
        const skipped = result.results.filter(r => r.status !== 'ok').length;
        enqueueSnackbar(`Imported ${ok} keybox${ok !== 1 ? 'es' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`, { variant: 'success' });
        await fetchHistory();
      } else enqueueSnackbar('Import failed', { variant: 'error' });
    } catch { enqueueSnackbar('Import failed', { variant: 'error' }); }
    finally { setIsImporting(false); }
  }, [token, fetchHistory, enqueueSnackbar]);

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
        if (selectedEntry?.source === entry.source && selectedEntry?.version === entry.version) setSelectedEntry(null);
        await fetchHistory();
      } else enqueueSnackbar('Delete failed', { variant: 'error' });
    } catch { enqueueSnackbar('Delete failed', { variant: 'error' }); }
  }, [token, fetchHistory, selectedEntry, enqueueSnackbar]);

  return (
    <Box sx={{ p: 4, maxWidth: 800, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Keybox History</Typography>
          <Typography variant="body2" color="text.secondary">
            All known keyboxes — {entries.length} version{entries.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{
        border: `2px dashed ${dragging ? 'var(--mdui-color-primary, #A8C7FA)' : 'var(--mdui-color-outline, #8E9099)'}`,
        borderRadius: '12px', p: 3, mb: 2, textAlign: 'center', cursor: 'pointer',
        transition: 'border-color 150ms, background 150ms',
        bgcolor: dragging ? 'rgba(168,199,250,0.05)' : 'transparent',
      }}
        onDrop={handleDrop} onDragOver={handleDragOver}
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2">{isImporting ? 'Importing...' : 'Drop XML or JSON files here, or click to browse'}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          JSON format: [{'{'} "source": "yuri", "version": "1", "content": "&lt;xml&gt;..." {'}'}]
        </Typography>
        <input ref={fileInputRef} type="file" accept=".xml,.json" multiple style={{ display: 'none' }}
          onChange={e => handleImport(e.target.files)} />
        {isImporting && <CircularProgress size={24} sx={{ mt: 1 }} />}
      </Box>

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
          onClick={() => {
            if (selectMode) {
              setSelectMode(false);
              setSelectedIds(new Set());
            } else {
              setSelectMode(true);
            }
          }}
          sx={{ cursor: 'pointer' }}
        />
        {selectMode && (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            sx={{ textTransform: 'none', minWidth: 'auto', fontSize: 12, height: 24 }}
          >
            Cancel
          </Button>
        )}
        {selectMode && selectedIds.size > 0 && (
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteSweepIcon />}
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
              await fetchHistory();
            }}
            disabled={isDeleting}
            sx={{ textTransform: 'none', height: 24 }}
          >
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
          <Typography variant="h6">{searchQuery || sourceFilter ? 'No matching versions' : 'No history yet'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery || sourceFilter ? 'Try a different search term or filter' : 'Import keyboxes to build the history'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(entry => {
            const key = entryKey(entry);
            const isSelected = selectedIds.has(key);
            return (
              <Box key={key}>
                <Box
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.MuiCheckbox-root')) return;
                    setSelectedEntry(selectedEntry?.source === entry.source && selectedEntry?.version === entry.version ? null : entry);
                  }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    p: '12px 16px', borderRadius: '8px',
                    bgcolor: isSelected ? 'rgba(168,199,250,0.12)' : 'surfaceContainer.main',
                    cursor: 'pointer', transition: 'background 150ms',
                    '&:hover': { bgcolor: 'surfaceContainerHigh.main' },
                  }}
                >
                  <Box sx={{ width: 36, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                    {selectMode && (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleToggleSelect(entry)}
                        size="small"
                        sx={{ p: 0.5 }}
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>{entry.source} v</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{entry.version}</Typography>
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
                    {selectedEntry?.source === entry.source && selectedEntry?.version === entry.version
                      ? <ExpandLessIcon sx={{ color: 'text.secondary' }} />
                      : <ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                  </Box>
                </Box>
                {selectedEntry?.source === entry.source && selectedEntry?.version === entry.version && (
                  <Box sx={{
                    p: '12px 16px', borderRadius: '0 0 8px 8px',
                    bgcolor: 'surfaceContainer.main',
                    borderTop: '1px solid var(--mdui-color-outline-variant, #44474F)',
                  }}>
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
                    <Box sx={{ mt: 1.5 }}>
                      <Button variant="outlined" size="small" startIcon={<DeleteIcon />} color="error"
                        onClick={(e) => { e.stopPropagation(); handleDelete(entry); }} sx={{ textTransform: 'none' }}>
                        Delete
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
