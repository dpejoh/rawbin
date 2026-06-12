import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, TextField, Button, IconButton, Chip, CircularProgress,
  InputAdornment, Box, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import { useSnackbar } from 'notistack';
import useAPKs from '../../hooks/useAPKs';
import { relativeTime, formatSize } from '../../utils/time';
import type { APK } from '../../hooks/useAPKs';

interface APKsPageProps {
  token: string | null;
}

export default function APKsPage({ token }: APKsPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { apks, isLoading, fetchAll, upload, remove } = useAPKs();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<APK | null>(null);
  const [uploadTarget, setUploadTarget] = useState<APK | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortBy, setSortBy] = useState<'packageName' | 'appName' | 'versionCode' | 'updatedAt'>('updatedAt');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      <Box sx={{
        border: '2px dashed var(--mdui-color-outline, #8E9099)',
        borderRadius: '12px', p: 2, mb: 2, textAlign: 'center', cursor: 'pointer',
        transition: 'border-color 150ms, background 150ms',
        '&:hover': { borderColor: 'primary.main' },
      }} onClick={() => fileInputRef.current?.click()}>
        <UploadFileIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
        <Typography variant="body2">Drop .apk files here or click to upload</Typography>
        <input ref={fileInputRef} type="file" accept=".apk" style={{ display: 'none' }} onChange={handleFileSelect} />
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => handleUploadClick()}
          sx={{ textTransform: 'none' }}>
          Upload APK
        </Button>
      </Stack>

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
              {displayEntries.map(apk => (
                <TableRow key={apk.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
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
                    <IconButton size="small" onClick={() => handleUploadClick(apk)} title="Update APK">
                      <CloudUploadIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(apk)} title="Delete" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
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
