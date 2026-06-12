import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, TextField, Button, IconButton, Chip, CircularProgress,
  InputAdornment, Box, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { useSnackbar } from 'notistack';

interface AppCatalogEntry {
  packageName: string;
  appName: string;
}

interface AppCatalogProps {
  token: string | null;
  role: string;
}

export default function AppCatalog({ token, role }: AppCatalogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [entries, setEntries] = useState<AppCatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortBy, setSortBy] = useState<'packageName' | 'appName'>('packageName');
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addPackageName, setAddPackageName] = useState('');
  const [addAppName, setAddAppName] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editOriginalPkg, setEditOriginalPkg] = useState('');
  const [editPackageName, setEditPackageName] = useState('');
  const [editAppName, setEditAppName] = useState('');

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/.netlify/functions/apps');
      if (res.ok) {
        const data = (await res.json()) as Record<string, string>;
        const list = Object.entries(data).map(([packageName, appName]) => ({ packageName, appName }));
        setEntries(list);
      }
    } catch { }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const displayEntries = [...entries]
    .filter(e => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return e.packageName.toLowerCase().includes(q) || e.appName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      return a[sortBy].localeCompare(b[sortBy]) * dir;
    });

  const handleToggleSelect = useCallback((pkg: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  }, []);

  const handleAdd = useCallback(async () => {
    if (!token || !addPackageName.trim() || !addAppName.trim()) return;
    try {
      const res = await fetch('/.netlify/functions/apps/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: addPackageName.trim(), appName: addAppName.trim() }),
      });
      if (res.ok) {
        enqueueSnackbar(`${addPackageName.trim()} added`, { variant: 'success' });
        setAddDialogOpen(false);
        setAddPackageName('');
        setAddAppName('');
        await fetchCatalog();
      } else {
        enqueueSnackbar('Failed to add', { variant: 'error' });
      }
    } catch { enqueueSnackbar('Failed to add', { variant: 'error' }); }
  }, [token, addPackageName, addAppName, fetchCatalog, enqueueSnackbar]);

  const handleEdit = useCallback(async () => {
    if (!token || !editPackageName.trim() || !editAppName.trim()) return;
    try {
      // If package name changed, delete old then save new
      if (editOriginalPkg !== editPackageName.trim()) {
        await fetch('/.netlify/functions/apps', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ packageName: editOriginalPkg }),
        });
      }
      const res = await fetch('/.netlify/functions/apps/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: editPackageName.trim(), appName: editAppName.trim() }),
      });
      if (res.ok) {
        enqueueSnackbar('Entry updated', { variant: 'success' });
        setEditDialogOpen(false);
        await fetchCatalog();
      } else {
        enqueueSnackbar('Failed to update', { variant: 'error' });
      }
    } catch { enqueueSnackbar('Failed to update', { variant: 'error' }); }
  }, [token, editOriginalPkg, editPackageName, editAppName, fetchCatalog, enqueueSnackbar]);

  const handleDelete = useCallback(async (pkg: string) => {
    if (!token) return;
    try {
      const res = await fetch('/.netlify/functions/apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: pkg }),
      });
      if (res.ok) {
        enqueueSnackbar(`${pkg} deleted`, { variant: 'success' });
        await fetchCatalog();
      } else enqueueSnackbar('Delete failed', { variant: 'error' });
    } catch { enqueueSnackbar('Delete failed', { variant: 'error' }); }
  }, [token, fetchCatalog, enqueueSnackbar]);

  const handleBulkDelete = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/.netlify/functions/apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: Array.from(selectedIds) }),
      });
      if (res.ok) {
        enqueueSnackbar(`Deleted ${selectedIds.size} entries`, { variant: 'success' });
        setSelectedIds(new Set());
        setSelectMode(false);
        await fetchCatalog();
      } else enqueueSnackbar('Bulk delete failed', { variant: 'error' });
    } catch { enqueueSnackbar('Bulk delete failed', { variant: 'error' }); }
    finally { setIsDeleting(false); }
  }, [token, selectedIds, fetchCatalog, enqueueSnackbar]);

  const handleImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !token) return;
    setIsImporting(true);
    const entriesToImport: Array<{ packageName: string; appName: string }> = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        if (!file.name.endsWith('.json')) continue;
        const parsed = JSON.parse(text);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          const pkg = item.packageName || item.package_name || item.package;
          const name = item.appName || item.app_name || item.name || item.label;
          if (pkg && name) {
            entriesToImport.push({ packageName: pkg, appName: name });
          } else if (typeof item === 'string') {
            continue;
          } else {
            // flat format: { "pkg.name": "App Name", ... }
            for (const [key, val] of Object.entries(item)) {
              if (typeof val === 'string' && key.length > 3 && key.includes('.')) {
                entriesToImport.push({ packageName: key, appName: val });
              }
            }
          }
        }
      } catch { }
    }
    if (entriesToImport.length === 0) {
      enqueueSnackbar('No valid entries found', { variant: 'error' });
      setIsImporting(false);
      return;
    }
    try {
      const res = await fetch('/.netlify/functions/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(entriesToImport),
      });
      if (res.ok) {
        const result = await res.json() as { imported: number; total: number };
        enqueueSnackbar(`Imported ${result.imported} entries (${result.total} total)`, { variant: 'success' });
        await fetchCatalog();
      } else enqueueSnackbar('Import failed', { variant: 'error' });
    } catch { enqueueSnackbar('Import failed', { variant: 'error' }); }
    finally { setIsImporting(false); }
  }, [token, fetchCatalog, enqueueSnackbar]);

  const handleExport = useCallback(() => {
    const data: Record<string, string> = {};
    for (const e of entries) data[e.packageName] = e.appName;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app-catalog.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); dragCounter.current = 0;
    handleImport(e.dataTransfer.files);
  }, [handleImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const handleDragEnter = useCallback(() => { dragCounter.current++; setDragging(true); }, []);
  const handleDragLeave = useCallback(() => { dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }, []);

  const handleOpenEdit = useCallback((entry: AppCatalogEntry) => {
    setEditOriginalPkg(entry.packageName);
    setEditPackageName(entry.packageName);
    setEditAppName(entry.appName);
    setEditDialogOpen(true);
  }, []);

  return (
    <Box sx={{ p: 4, maxWidth: 800, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>App Catalog</Typography>
          <Typography variant="body2" color="text.secondary">
            {entries.length} package{entries.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Stack>

      {role === 'admin' && (
        <Box sx={{
          border: `2px dashed ${dragging ? 'var(--mdui-color-primary, #A8C7FA)' : 'var(--mdui-color-outline, #8E9099)'}`,
          borderRadius: '12px', p: 2, mb: 2, textAlign: 'center', cursor: 'pointer',
          transition: 'border-color 150ms, background 150ms',
          bgcolor: dragging ? 'rgba(168,199,250,0.05)' : 'transparent',
        }}
          onDrop={handleDrop} onDragOver={handleDragOver}
          onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
          onClick={() => { if (!isImporting) fileInputRef.current?.click(); }}
        >
          <CloudUploadIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
          <Typography variant="body2">{isImporting ? 'Importing...' : 'Drop JSON files here to import'}</Typography>
          <input ref={fileInputRef} type="file" accept=".json" multiple style={{ display: 'none' }}
            onChange={e => handleImport(e.target.files)} />
          {isImporting && <CircularProgress size={20} sx={{ mt: 0.5 }} />}
        </Box>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
        {role === 'admin' && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setAddPackageName(''); setAddAppName(''); setAddDialogOpen(true); }}
            sx={{ textTransform: 'none' }}>
            Add Entry
          </Button>
        )}
        <Button variant="outlined" startIcon={<CloudDownloadIcon />} onClick={handleExport}
          sx={{ textTransform: 'none' }}>
          Export
        </Button>
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
        {role === 'admin' && selectMode && selectedIds.size > 0 && (
          <Button variant="contained" color="error" size="small" startIcon={<DeleteSweepIcon />}
            onClick={handleBulkDelete} disabled={isDeleting}
            sx={{ textTransform: 'none', height: 24 }}>
            {isDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
          </Button>
        )}
      </Stack>

      <TextField variant="filled" fullWidth placeholder="Search by package name or app name..."
        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2 }}
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
          {[1, 2, 3, 4].map(i => <Box key={i} className="skeleton" sx={{ height: 52, borderRadius: '8px' }} />)}
        </Stack>
      ) : entries.length === 0 ? (
        <Box className="empty-state" sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', p: '64px 24px', textAlign: 'center' }}>
          <PlaylistAddCheckIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6">No packages yet</Typography>
          <Typography variant="body2" color="text.secondary">
            Add entries manually or import a JSON file to get started
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {selectMode && <TableCell padding="checkbox" sx={{ width: 40 }} />}
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel active={sortBy === 'packageName'} direction={sortBy === 'packageName' ? sortOrder : 'asc'}
                    onClick={() => { if (sortBy === 'packageName') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSortBy('packageName'); setSortOrder('asc'); } }}>
                    Package Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel active={sortBy === 'appName'} direction={sortBy === 'appName' ? sortOrder : 'asc'}
                    onClick={() => { if (sortBy === 'appName') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSortBy('appName'); setSortOrder('asc'); } }}>
                    App Name
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayEntries.map(entry => {
                const isSelected = selectedIds.has(entry.packageName);
                return (
                  <TableRow key={entry.packageName}
                    hover selected={isSelected}
                    sx={{ '&:hover': { bgcolor: 'action.hover' }, cursor: 'default' }}
                  >
                    {selectMode && (
                      <TableCell padding="checkbox" onClick={() => handleToggleSelect(entry.packageName)} sx={{ cursor: 'pointer' }}>
                        <Box sx={{ width: 18, height: 18, borderRadius: '4px', border: '2px solid', borderColor: isSelected ? 'primary.main' : 'outline.main', bgcolor: isSelected ? 'primary.main' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isSelected && <Box sx={{ width: 6, height: 6, borderRadius: '1px', bgcolor: 'white', transform: 'rotate(45deg)' }} />}
                        </Box>
                      </TableCell>
                    )}
                    <TableCell sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 13 }}>{entry.packageName}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{entry.appName}</TableCell>
                    <TableCell align="right">
                      {role === 'admin' && (
                        <>
                          <IconButton size="small" onClick={() => handleOpenEdit(entry)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => handleDelete(entry.packageName)} title="Delete" color="error"><DeleteIcon fontSize="small" /></IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Entry</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField autoFocus label="Package Name" fullWidth placeholder="com.example.app"
              value={addPackageName} onChange={(e) => setAddPackageName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('add-app-name')?.focus(); }}
              inputProps={{ spellCheck: false, fontFamily: '"Geist Mono", monospace' }}
            />
            <TextField id="add-app-name" label="App Name" fullWidth placeholder="Example App"
              value={addAppName} onChange={(e) => setAddAppName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!addPackageName.trim() || !addAppName.trim()}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Entry</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField autoFocus label="Package Name" fullWidth placeholder="com.example.app"
              value={editPackageName} onChange={(e) => setEditPackageName(e.target.value)}
              inputProps={{ spellCheck: false, fontFamily: '"Geist Mono", monospace' }}
            />
            <TextField label="App Name" fullWidth placeholder="Example App"
              value={editAppName} onChange={(e) => setEditAppName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={!editPackageName.trim() || !editAppName.trim()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
