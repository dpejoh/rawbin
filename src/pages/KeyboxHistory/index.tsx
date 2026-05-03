import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HistoryIcon from '@mui/icons-material/History';
import GppBadIcon from '@mui/icons-material/GppBad';
import { useSnackbar } from 'notistack';
import RawUrlRow from '../../components/RawUrlRow';

interface HistoryEntry {
  version: string;
  serial: string;
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
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/.netlify/functions/history');
      if (res.ok) {
        const data = await res.json() as { entries: HistoryEntry[]; latest?: string };
        const list = Array.isArray(data) ? data : data.entries;
        setEntries(list.sort((a, b) => {
          const na = parseInt(a.version, 10);
          const nb = parseInt(b.version, 10);
          if (!isNaN(na) && !isNaN(nb)) return nb - na;
          return b.timestamp.localeCompare(a.timestamp);
        }));
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !token) return;

    setIsImporting(true);
    const importData: Array<{ version: string; content: string }> = [];

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            importData.push(...parsed);
          } else if (parsed.version && parsed.content) {
            importData.push(parsed);
          }
        } else {
          const versionMatch = file.name.match(/(\d+)/);
          const fromName = versionMatch ? versionMatch[1] : '';
          let version = '';
          if (fromName) {
            version = fromName;
          }
          if (!version) {
            version = String(Date.now());
          }
          importData.push({ version, content: text });
        }
      } catch { /* skip unreadable files */ }
    }

    if (importData.length === 0) {
      enqueueSnackbar('No valid keyboxes found in selection', { variant: 'error' });
      setIsImporting(false);
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(importData),
      });
      if (res.ok) {
        const result = await res.json() as { imported: number; results: Array<{ version: string; status: string }> };
        const ok = result.results.filter(r => r.status === 'ok').length;
        const skipped = result.results.filter(r => r.status !== 'ok').length;
        enqueueSnackbar(
          `Imported ${ok} keybox${ok !== 1 ? 'es' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`,
          { variant: 'success' },
        );
        await fetchHistory();
      } else {
        enqueueSnackbar('Import failed', { variant: 'error' });
      }
    } catch {
      enqueueSnackbar('Import failed', { variant: 'error' });
    } finally {
      setIsImporting(false);
    }
  }, [token, fetchHistory, enqueueSnackbar]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    dragCounter.current = 0;
    handleImport(e.dataTransfer.files);
  }, [handleImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback(() => {
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const filtered = searchQuery.trim()
    ? entries.filter(e =>
        e.version.includes(searchQuery.trim()) ||
        e.serial.includes(searchQuery.trim())
      )
    : entries;

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  const handleDelete = useCallback(async (entry: HistoryEntry) => {
    if (!token) return;
    try {
      const res = await fetch('/.netlify/functions/history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version: entry.version }),
      });
      if (res.ok) {
        enqueueSnackbar(`v${entry.version} deleted`, { variant: 'success' });
        if (selectedEntry?.version === entry.version) setSelectedEntry(null);
        await fetchHistory();
      } else {
        enqueueSnackbar('Delete failed', { variant: 'error' });
      }
    } catch {
      enqueueSnackbar('Delete failed', { variant: 'error' });
    }
  }, [token, fetchHistory, selectedEntry, enqueueSnackbar]);

  return (
    <div style={{ padding: 32, maxWidth: 800, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            Keybox History
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            All known Yuri keyboxes — {entries.length} version{entries.length !== 1 ? 's' : ''}
          </Typography>
        </div>
      </div>

      <div
        style={{
          border: `2px dashed ${dragging ? 'var(--mdui-color-primary, #A8C7FA)' : 'var(--mdui-color-outline, #8E9099)'}`,
          borderRadius: 12,
          padding: 24,
          marginBottom: 16,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 150ms, background 150ms',
          background: dragging ? 'rgba(168, 199, 250, 0.05)' : 'transparent',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2">
          {isImporting ? 'Importing...' : 'Drop XML or JSON files here, or click to browse'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          JSON format: {'{'}"version": "1", "content": "&lt;xml&gt;..."{'}'}
        </Typography>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.json"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleImport(e.target.files)}
        />
        {isImporting && <CircularProgress size={24} sx={{ mt: 1 }} />}
      </div>

      <TextField
        variant="filled"
        fullWidth
        placeholder="Search by version or serial..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2, '& .MuiInputBase-input': { fontFamily: '"Geist Mono", monospace' } }}
        InputProps={{
          endAdornment: searchQuery ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchQuery('')}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
      />

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <HistoryIcon sx={{ fontSize: 48, color: 'outline.main' }} />
          <Typography variant="h6">{searchQuery ? 'No matching versions' : 'No history yet'}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {searchQuery ? 'Try a different search term' : 'Import keyboxes to build the history'}
          </Typography>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(entry => (
            <div key={entry.version}>
              <div
                onClick={() => setSelectedEntry(selectedEntry?.version === entry.version ? null : entry)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: 'var(--mdui-color-surface-container, #1E2128)',
                  cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--mdui-color-surface-container-high, #282C34)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--mdui-color-surface-container, #1E2128)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'center', minWidth: 48 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1 }}>v</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{entry.version}</Typography>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FingerprintIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                      <Typography variant="caption" sx={{ fontFamily: '"Geist Mono", monospace' }}>
                        {entry.serial}
                      </Typography>
                    </div>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {formatDate(entry.timestamp)}
                    </Typography>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Chip
                    icon={<GppBadIcon />}
                    label="Revoked"
                    size="small"
                    sx={{ color: 'error.main', '& .MuiChip-icon': { color: 'error.main' } }}
                  />
                  {selectedEntry?.version === entry.version ? (
                    <ExpandLessIcon sx={{ color: 'text.secondary' }} />
                  ) : (
                    <ExpandMoreIcon sx={{ color: 'text.secondary' }} />
                  )}
                </div>
              </div>
              {selectedEntry?.version === entry.version && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '0 0 8px 8px',
                  background: 'var(--mdui-color-surface-container, #1E2128)',
                  borderTop: '1px solid var(--mdui-color-outline-variant, #44474F)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Version</Typography>
                    <Typography variant="caption">{entry.version}</Typography>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Serial</Typography>
                    <Typography variant="caption" sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, wordBreak: 'break-all', ml: 2 }}>
                      {entry.serial}
                    </Typography>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Date</Typography>
                    <Typography variant="caption">{new Date(entry.timestamp).toLocaleString()}</Typography>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, paddingBottom: 4 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Status</Typography>
                    <Chip icon={<GppBadIcon />} label="Revoked" size="small" sx={{ color: 'error.main', '& .MuiChip-icon': { color: 'error.main' } }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <RawUrlRow url={`${window.location.origin}/key/${entry.version}`} />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DeleteIcon />}
                      color="error"
                      onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                      sx={{ textTransform: 'none' }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
