import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, TextField, Button, IconButton, Tooltip, Chip, CircularProgress,
  InputAdornment, Box, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import EditIcon from '@mui/icons-material/Edit';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import { useSnackbar } from 'notistack';
import useAPKs from '../../hooks/useAPKs';
import { relativeTime, formatSize } from '../../utils/time';
import { parseAPK } from '../../utils/parseAPK';
import type { APK } from '../../hooks/useAPKs';

interface APKsPageProps {
  token: string | null;
  role: string;
}

interface EditForm {
  packageName: string;
  appName: string;
  versionCode: number;
  versionName: string;
}

export default function APKsPage({ token, role }: APKsPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { apks, isLoading, fetchAll, upload, remove } = useAPKs();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<APK | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortBy, setSortBy] = useState<'packageName' | 'appName' | 'versionCode' | 'updatedAt'>('updatedAt');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<APK | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ packageName: '', appName: '', versionCode: 0, versionName: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const dropInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (token) fetchAll(token);
  }, [token, fetchAll]);

  const displayEntries = [...apks]
    .filter(a => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return a.packageName.toLowerCase().includes(q) || a.appName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'versionCode') return (a.versionCode - b.versionCode) * dir;
      if (sortBy === 'updatedAt') return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') * dir;
      return a[sortBy].localeCompare(b[sortBy]) * dir;
    });

  const handleFiles = useCallback(async (files: FileList) => {
    if (!token) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (!file.name.endsWith('.apk') && !file.name.endsWith('.apks')) {
        enqueueSnackbar(`Skipped "${file.name}" — only .apk/.apks files are supported`, { variant: 'warning' });
        continue;
      }
      setIsUploading(true);
      const parsed = await parseAPK(file);
      const metadata = parsed
        ? {
            packageName: parsed.packageName,
            appName: parsed.label || parsed.packageName,
            versionCode: parsed.versionCode,
            versionName: parsed.versionName,
          }
        : {
            packageName: file.name.replace(/\.apks?$/i, '').replace(/[_-]\d+.*$/, '').trim(),
            appName: file.name.replace(/\.apks?$/i, '').replace(/[_-]\d+.*$/, '').trim(),
            versionCode: 0,
            versionName: '',
          };
      const result = await upload(token, file, metadata);
      if (result) {
        enqueueSnackbar(`"${metadata.packageName}" uploaded`, { variant: 'success' });
      } else {
        enqueueSnackbar(`"${metadata.packageName}" upload failed`, { variant: 'error' });
      }
      setIsUploading(false);
    }
    await fetchAll(token);
  }, [token, upload, fetchAll, enqueueSnackbar]);

  const handleDropZoneFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (files && files.length > 0) await handleFiles(files);
  }, [handleFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !token) return;
    if (!file.name.endsWith('.apk') && !file.name.endsWith('.apks')) {
      enqueueSnackbar('Only .apk/.apks files are supported', { variant: 'error' });
      return;
    }
    const parsed = await parseAPK(file);
    const metadata = parsed
      ? { packageName: parsed.packageName, appName: parsed.label || parsed.packageName, versionCode: parsed.versionCode, versionName: parsed.versionName }
      : { packageName: file.name.replace(/\.apks?$/i, '').replace(/[_-]\d+.*$/, '').trim(), appName: file.name.replace(/\.apks?$/i, '').replace(/[_-]\d+.*$/, '').trim(), versionCode: 0, versionName: '' };
    const result = await upload(token, file, metadata);
    if (result) {
      enqueueSnackbar('APK uploaded', { variant: 'success' });
      await fetchAll(token);
    } else {
      enqueueSnackbar('Upload failed', { variant: 'error' });
    }
  }, [token, upload, fetchAll, enqueueSnackbar]);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteTarget) return;
    const ok = await remove(token, deleteTarget.id);
    if (ok) {
      enqueueSnackbar(`APK "${deleteTarget.packageName}" deleted`, { variant: 'success' });
      await fetchAll(token);
    } else {
      enqueueSnackbar('Delete failed', { variant: 'error' });
    }
    setDeleteTarget(null);
  }, [token, deleteTarget, remove, fetchAll, enqueueSnackbar]);

  const handleCopyUrl = useCallback(async (apk: APK) => {
    const r2Worker = import.meta.env.VITE_R2_WORKER_URL ?? "http://localhost:8787";
    const url = `${r2Worker}/raw/apks/${encodeURIComponent(`${apk.packageName}.apk`)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(apk.packageName);
      enqueueSnackbar('Raw URL copied', { variant: 'info' });
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      enqueueSnackbar('Failed to copy', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const handleEditOpen = useCallback((apk: APK) => {
    setEditTarget(apk);
    setEditForm({
      packageName: apk.packageName,
      appName: apk.appName,
      versionCode: apk.versionCode,
      versionName: apk.versionName,
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!token || !editTarget) return;
    const { packageName, appName, versionCode, versionName } = editForm;
    if (!packageName.trim()) { enqueueSnackbar('Package name is required', { variant: 'error' }); return; }
    setIsSavingEdit(true);
    try {
      const res = await fetch('/.netlify/functions/apks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editTarget.packageName, packageName, appName, versionCode, versionName }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (data.error) {
        enqueueSnackbar(String(data.error), { variant: 'error' });
      } else {
        enqueueSnackbar('APK metadata updated', { variant: 'success' });
        setEditTarget(null);
        await fetchAll(token);
      }
    } catch {
      enqueueSnackbar('Failed to save', { variant: 'error' });
    }
    setIsSavingEdit(false);
  }, [token, editTarget, editForm, fetchAll, enqueueSnackbar]);

  const handleBulkDelete = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    let ok = 0; let fail = 0;
    for (const pkg of selectedIds) {
      const res = await remove(token, pkg);
      if (res) ok++; else fail++;
    }
    enqueueSnackbar(`Deleted ${ok} APK${ok !== 1 ? 's' : ''}${fail > 0 ? ` (${fail} failed)` : ''}`, { variant: fail === 0 ? 'success' : 'error' });
    setSelectedIds(new Set());
    setSelectMode(false);
    setIsBatchDeleting(false);
    await fetchAll(token);
  }, [token, selectedIds, remove, fetchAll, enqueueSnackbar]);

  return (
    <Box sx={{ p: 4, maxWidth: 800, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleDrop}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>APKs</Typography>
          <Typography variant="body2" color="text.secondary">
            {apks.length} package{apks.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Stack>

      {role !== 'viewer' && (
        <Box sx={{
          border: '2px dashed var(--mdui-color-outline, #8E9099)',
          borderRadius: '12px', p: 2, mb: 2, textAlign: 'center', cursor: 'pointer',
          transition: 'border-color 150ms, background 150ms',
          '&:hover': { borderColor: 'primary.main' },
          opacity: isUploading ? 0.6 : 1,
        }} onClick={() => dropInputRef.current?.click()}>
          <UploadFileIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
          <Typography variant="body2">{isUploading ? 'Uploading...' : 'Drop .apk/.apks files here or click to upload'}</Typography>
          <input ref={dropInputRef} type="file" accept=".apk,.apks" multiple style={{ display: 'none' }} onChange={handleDropZoneFiles} />
        </Box>
      )}

      <TextField variant="filled" fullWidth placeholder="Search by package name or app name..."
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

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Chip
          label={selectMode ? `${selectedIds.size} selected` : 'Select'}
          size="small"
          variant={selectMode ? 'filled' : 'outlined'}
          color={selectMode ? 'primary' : 'default'}
          onClick={() => {
            if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); }
            else setSelectMode(true);
          }}
          sx={{ cursor: 'pointer' }}
        />
        {selectMode && (
          <Button variant="text" size="small"
            onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
            sx={{ textTransform: 'none', minWidth: 'auto', fontSize: 12, height: 24 }}>
            Cancel
          </Button>
        )}
        {role !== 'viewer' && selectMode && selectedIds.size > 0 && (
          <Button variant="contained" color="error" size="small" startIcon={<DeleteSweepIcon />}
            onClick={handleBulkDelete} disabled={isBatchDeleting}
            sx={{ textTransform: 'none', height: 24 }}>
            {isBatchDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
          </Button>
        )}
      </Stack>

      {isLoading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map(i => <Box key={i} className="skeleton" sx={{ height: 52, borderRadius: '8px' }} />)}
        </Stack>
      ) : displayEntries.length === 0 ? (
        <Box className="empty-state">
          <SmartphoneIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6">{searchQuery ? 'No matching APKs' : 'No APKs yet'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery ? 'Try a different search term' : 'Upload an APK file to get started'}
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
                    Package
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel active={sortBy === 'appName'} direction={sortBy === 'appName' ? sortOrder : 'asc'}
                    onClick={() => { if (sortBy === 'appName') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSortBy('appName'); setSortOrder('asc'); } }}>
                    App
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel active={sortBy === 'versionCode'} direction={sortBy === 'versionCode' ? sortOrder : 'asc'}
                    onClick={() => { if (sortBy === 'versionCode') setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSortBy('versionCode'); setSortOrder('desc'); } }}>
                    Version
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayEntries.map(apk => {
                const isSelected = selectedIds.has(apk.packageName);
                return (
                <TableRow key={apk.id} hover selected={isSelected} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  {selectMode && (
                    <TableCell padding="checkbox" onClick={() => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(apk.packageName)) next.delete(apk.packageName);
                        else next.add(apk.packageName);
                        return next;
                      });
                    }} sx={{ cursor: 'pointer' }}>
                      <Box sx={{ width: 18, height: 18, borderRadius: '4px', border: '2px solid', borderColor: isSelected ? 'primary.main' : 'outline.main', bgcolor: isSelected ? 'primary.main' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <Box sx={{ width: 6, height: 6, borderRadius: '1px', bgcolor: 'white', transform: 'rotate(45deg)' }} />}
                      </Box>
                    </TableCell>
                  )}
                  <TableCell sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 13 }}>{apk.packageName}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{apk.appName}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: '"Geist Mono", monospace' }}>
                      v{apk.versionName || apk.versionCode}
                    </Typography>
                    {apk.versionCode > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        (code {apk.versionCode})
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{formatSize(apk.size)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit metadata">
                      <IconButton size="small" onClick={() => handleEditOpen(apk)} sx={{ color: 'text.secondary' }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy raw URL">
                      <IconButton size="small" onClick={() => handleCopyUrl(apk)} sx={{ color: 'text.secondary' }}>
                        {copiedId === apk.packageName ? <CheckIcon fontSize="small" sx={{ color: 'success.main' }} /> : <ContentCopyIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    {role !== 'viewer' && (
                      <IconButton size="small" onClick={() => setDeleteTarget(apk)} title="Delete" color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete APK &ldquo;{deleteTarget?.packageName}&rdquo;?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently remove the APK and its raw endpoint.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit &ldquo;{editTarget?.packageName}&rdquo;</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField autoFocus fullWidth label="Package name" size="small"
              value={editForm.packageName}
              onChange={(e) => setEditForm(f => ({ ...f, packageName: e.target.value }))}
            />
            <TextField fullWidth label="App name" size="small"
              value={editForm.appName}
              onChange={(e) => setEditForm(f => ({ ...f, appName: e.target.value }))}
            />
            <TextField fullWidth label="Version code" size="small" type="number"
              value={editForm.versionCode}
              onChange={(e) => setEditForm(f => ({ ...f, versionCode: parseInt(e.target.value, 10) || 0 }))}
            />
            <TextField fullWidth label="Version name" size="small"
              value={editForm.versionName}
              onChange={(e) => setEditForm(f => ({ ...f, versionName: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={isSavingEdit || !editForm.packageName.trim()}>
            {isSavingEdit ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
