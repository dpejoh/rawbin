import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, TextField, Button, IconButton, Chip, CircularProgress,
  InputAdornment, Checkbox, Box, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import { useSnackbar } from 'notistack';
import useAPKs from '../../hooks/useAPKs';
import { relativeTime, formatSize } from '../../utils/time';
import type { APK } from '../../hooks/useAPKs';

interface APKsPageProps {
  token: string | null;
  role: string;
}

export default function APKsPage({ token, role }: APKsPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { apks, isLoading, fetchAll, upload, remove } = useAPKs();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<APK | null>(null);
  const [uploadTarget, setUploadTarget] = useState<APK | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortBy, setSortBy] = useState<'packageName' | 'appName' | 'versionCode' | 'updatedAt'>('updatedAt');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleUploadClick = useCallback((apk?: APK) => {
    setUploadTarget(apk ?? null);
    setUploadFile(null);
    setUploadOpen(true);
  }, []);

  const handleDropZoneFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || !token) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (!file.name.endsWith('.apk')) {
        enqueueSnackbar(`Skipped "${file.name}" — only .apk files are supported`, { variant: 'warning' });
        continue;
      }
      setIsUploading(true);
      const guessPkg = file.name.replace(/\.apk$/i, '').replace(/[_-]\d+.*$/, '').trim();
      const result = await upload(token, file, {
        packageName: guessPkg, appName: guessPkg, versionCode: 0, versionName: '',
      });
      if (result) {
        enqueueSnackbar(`"${guessPkg}" uploaded`, { variant: 'success' });
      } else {
        enqueueSnackbar(`"${guessPkg}" upload failed`, { variant: 'error' });
      }
      setIsUploading(false);
    }
    await fetchAll(token);
  }, [token, upload, fetchAll, enqueueSnackbar]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
    e.target.value = '';
  }, []);

  const handleUpload = useCallback(async () => {
    if (!token || !uploadFile) return;
    const guessPkg = uploadTarget?.packageName ?? uploadFile.name.replace(/\.apk$/i, '').replace(/[_-]\d+.*$/, '').trim();
    const result = await upload(token, uploadFile, {
      packageName: guessPkg,
      appName: uploadTarget?.appName ?? guessPkg,
      versionCode: uploadTarget?.versionCode ?? 0,
      versionName: uploadTarget?.versionName ?? '',
    });
    if (result) {
      enqueueSnackbar(uploadTarget ? `APK "${uploadTarget.packageName}" updated` : 'APK uploaded', { variant: 'success' });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadTarget(null);
      await fetchAll(token);
    } else {
      enqueueSnackbar('Upload failed', { variant: 'error' });
    }
  }, [token, uploadFile, uploadTarget, upload, fetchAll, enqueueSnackbar]);

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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !token) return;
    if (!file.name.endsWith('.apk')) {
      enqueueSnackbar('Only .apk files are supported', { variant: 'error' });
      return;
    }
    const guessPkg = file.name.replace(/\.apk$/i, '').replace(/[_-]\d+.*$/, '').trim();
    const result = await upload(token, file, {
      packageName: guessPkg, appName: guessPkg,
      versionCode: 0, versionName: '',
    });
    if (result) {
      enqueueSnackbar('APK uploaded', { variant: 'success' });
      await fetchAll(token);
    } else {
      enqueueSnackbar('Upload failed', { variant: 'error' });
    }
  }, [token, upload, fetchAll, enqueueSnackbar]);

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
        <>
          <Box sx={{
            border: '2px dashed var(--mdui-color-outline, #8E9099)',
            borderRadius: '12px', p: 2, mb: 2, textAlign: 'center', cursor: 'pointer',
            transition: 'border-color 150ms, background 150ms',
            '&:hover': { borderColor: 'primary.main' },
            opacity: isUploading ? 0.6 : 1,
          }} onClick={() => dropInputRef.current?.click()}>
            <UploadFileIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
            <Typography variant="body2">{isUploading ? 'Uploading...' : 'Drop .apk files here or click to upload'}</Typography>
            <input ref={dropInputRef} type="file" accept=".apk" multiple style={{ display: 'none' }} onChange={handleDropZoneFiles} />
          </Box>

          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => handleUploadClick()}
              sx={{ textTransform: 'none' }}>
              Upload APK
            </Button>
          </Stack>
        </>
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
                    {role !== 'viewer' && (
                      <>
                        <IconButton size="small" onClick={() => handleUploadClick(apk)} title="Update APK">
                          <CloudUploadIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteTarget(apk)} title="Delete" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
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

      <Dialog open={uploadOpen} onClose={() => { setUploadOpen(false); setUploadFile(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>{uploadTarget ? `Update "${uploadTarget.packageName}"` : 'Upload APK'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{
              border: '1px dashed var(--mdui-color-outline, #8E9099)',
              borderRadius: '8px', p: 2, textAlign: 'center', cursor: 'pointer',
              bgcolor: uploadFile ? 'rgba(168,199,250,0.05)' : 'transparent',
            }} onClick={() => fileInputRef.current?.click()}>
              {uploadFile ? (
                <Typography variant="body2" color="text.primary">{uploadFile.name}</Typography>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 24, color: 'text.secondary', mb: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">Click to select .apk file</Typography>
                </>
              )}
            </Box>
            <input ref={fileInputRef} type="file" accept=".apk" style={{ display: 'none' }} onChange={handleFileSelect} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setUploadOpen(false); setUploadFile(null); }}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload} disabled={!uploadFile}>
            {uploadTarget ? 'Update' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
}
