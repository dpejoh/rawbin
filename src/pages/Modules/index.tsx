import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, TextField, Button, IconButton, Tooltip, Chip, CircularProgress,
  InputAdornment, Box, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import EditIcon from '@mui/icons-material/Edit';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ExtensionIcon from '@mui/icons-material/Extension';
import { useSnackbar } from 'notistack';
import useModules from '../../hooks/useModules';
import { relativeTime, formatSize } from '../../utils/time';
import { parseModule } from '../../utils/parseModule';
import type { Module } from '../../hooks/useModules';

interface ModulesPageProps {
  token: string | null;
  role: string;
}

export default function ModulesPage({ token, role }: ModulesPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { modules, isLoading, fetchAll, upload, remove } = useModules();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Module | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Module | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Module | null>(null);
  const [editForm, setEditForm] = useState({ moduleId: '', name: '', version: '', versionCode: 1, author: '', description: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (token) fetchAll(token);
  }, [token, fetchAll]);

  const filtered = modules.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return m.moduleId.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.author.toLowerCase().includes(q);
  });

  const handleUploadClick = useCallback((module?: Module) => {
    setUploadTarget(module ?? null);
    setUploadFile(null);
    setUploadOpen(true);
  }, []);

  const handleDropZoneFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || !token) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (!file.name.endsWith('.zip')) {
        enqueueSnackbar(`Skipped "${file.name}" — only .zip files are supported`, { variant: 'warning' });
        continue;
      }
      setIsUploading(true);
      const parsed = await parseModule(file);
      const metadata = parsed ?? {
        moduleId: file.name.replace(/\.zip$/i, '').trim(),
        name: file.name.replace(/\.zip$/i, '').trim(),
        version: '1.0', versionCode: 1, author: '', description: '',
      };
      const result = await upload(token, file, metadata);
      if (result) {
        enqueueSnackbar(`"${metadata.moduleId}" uploaded`, { variant: 'success' });
      } else {
        enqueueSnackbar(`"${metadata.moduleId}" upload failed`, { variant: 'error' });
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
    const parsed = uploadTarget ? null : await parseModule(uploadFile);
    const metadata = uploadTarget
      ? {
          moduleId: uploadTarget.moduleId,
          name: uploadTarget.name,
          version: uploadTarget.version,
          versionCode: uploadTarget.versionCode,
          author: uploadTarget.author,
          description: uploadTarget.description,
        }
      : parsed ?? {
          moduleId: uploadFile.name.replace(/\.zip$/i, '').trim(),
          name: uploadFile.name.replace(/\.zip$/i, '').trim(),
          version: '1.0', versionCode: 1, author: '', description: '',
        };
    const result = await upload(token, uploadFile, metadata);
    if (result) {
      enqueueSnackbar(uploadTarget ? `Module "${uploadTarget.moduleId}" updated` : 'Module uploaded', { variant: 'success' });
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
      enqueueSnackbar(`Module "${deleteTarget.moduleId}" deleted`, { variant: 'success' });
      await fetchAll(token);
    } else {
      enqueueSnackbar('Delete failed', { variant: 'error' });
    }
    setDeleteTarget(null);
  }, [token, deleteTarget, remove, fetchAll, enqueueSnackbar]);

  const handleCopyUrl = useCallback(async (mod: Module) => {
    const r2Worker = import.meta.env.VITE_R2_WORKER_URL ?? "http://localhost:8787";
    const url = `${r2Worker}/raw/modules/${encodeURIComponent(`${mod.moduleId}.zip`)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(mod.moduleId);
      enqueueSnackbar('Raw URL copied', { variant: 'info' });
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      enqueueSnackbar('Failed to copy', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const handleEditOpen = useCallback((mod: Module) => {
    setEditTarget(mod);
    setEditForm({
      moduleId: mod.moduleId,
      name: mod.name,
      version: mod.version,
      versionCode: mod.versionCode,
      author: mod.author,
      description: mod.description,
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!token || !editTarget) return;
    const { moduleId, name, version, versionCode, author, description } = editForm;
    if (!moduleId.trim()) { enqueueSnackbar('Module ID is required', { variant: 'error' }); return; }
    setIsSavingEdit(true);
    try {
      const res = await fetch('/.netlify/functions/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editTarget.moduleId, moduleId, name, version, versionCode, author, description }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (data.error) {
        enqueueSnackbar(String(data.error), { variant: 'error' });
      } else {
        enqueueSnackbar('Module metadata updated', { variant: 'success' });
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
    for (const id of selectedIds) {
      const res = await remove(token, id);
      if (res) ok++; else fail++;
    }
    enqueueSnackbar(`Deleted ${ok} module${ok !== 1 ? 's' : ''}${fail > 0 ? ` (${fail} failed)` : ''}`, { variant: fail === 0 ? 'success' : 'error' });
    setSelectedIds(new Set());
    setSelectMode(false);
    setIsBatchDeleting(false);
    await fetchAll(token);
  }, [token, selectedIds, remove, fetchAll, enqueueSnackbar]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !token) return;
    if (!file.name.endsWith('.zip')) {
      enqueueSnackbar('Only .zip files are supported', { variant: 'error' });
      return;
    }
    const parsed = await parseModule(file);
    const metadata = parsed ?? {
      moduleId: file.name.replace(/\.zip$/i, '').trim(),
      name: file.name.replace(/\.zip$/i, '').trim(),
      version: '1.0', versionCode: 1, author: '', description: '',
    };
    const result = await upload(token, file, metadata);
    if (result) {
      enqueueSnackbar(`"${metadata.moduleId}" uploaded`, { variant: 'success' });
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
          <Typography variant="h4" sx={{ mb: 0.5 }}>Modules</Typography>
          <Typography variant="body2" color="text.secondary">
            {modules.length} module{modules.length !== 1 ? 's' : ''}
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
            <Typography variant="body2">{isUploading ? 'Uploading...' : 'Drop .zip files here or click to upload'}</Typography>
            <input ref={dropInputRef} type="file" accept=".zip" multiple style={{ display: 'none' }} onChange={handleDropZoneFiles} />
          </Box>

          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => handleUploadClick()}
              sx={{ textTransform: 'none' }}>
              Upload Module
            </Button>
          </Stack>
        </>
      )}

      <TextField variant="filled" fullWidth placeholder="Search by module ID, name, or author..."
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
          {[1, 2, 3].map(i => <Box key={i} className="skeleton" sx={{ height: 80, borderRadius: '8px' }} />)}
        </Stack>
      ) : filtered.length === 0 ? (
        <Box className="empty-state">
          <ExtensionIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6">{searchQuery ? 'No matching modules' : 'No modules yet'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery ? 'Try a different search term' : 'Upload a module zip to get started'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(mod => {
            const isSelected = selectedIds.has(mod.moduleId);
            return (
            <Box key={mod.id} sx={{
              display: 'flex', alignItems: 'center', gap: '12px',
              p: '12px 16px', borderRadius: '8px',
              bgcolor: isSelected ? 'rgba(168,199,250,0.12)' : 'surfaceContainer.main',
              transition: 'background 150ms',
              '&:hover': { bgcolor: isSelected ? 'rgba(168,199,250,0.12)' : 'surfaceContainerHigh.main' },
            }}>
              {selectMode && (
                <Box onClick={(e) => { e.stopPropagation();
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(mod.moduleId)) next.delete(mod.moduleId);
                    else next.add(mod.moduleId);
                    return next;
                  });
                }} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ width: 18, height: 18, borderRadius: '4px', border: '2px solid', borderColor: isSelected ? 'primary.main' : 'outline.main', bgcolor: isSelected ? 'primary.main' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isSelected && <Box sx={{ width: 6, height: 6, borderRadius: '1px', bgcolor: 'white', transform: 'rotate(45deg)' }} />}
                  </Box>
                </Box>
              )}
              <ExtensionIcon sx={{ fontSize: 24, color: 'primary.main', flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{mod.name}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontFamily: '"Geist Mono", monospace', color: 'text.secondary' }}>
                    {mod.moduleId}
                  </Typography>
                  <Typography variant="caption" color="outline.main">·</Typography>
                  <Typography variant="caption" color="text.secondary">v{mod.version} (code {mod.versionCode})</Typography>
                  {mod.author && (
                    <>
                      <Typography variant="caption" color="outline.main">·</Typography>
                      <Typography variant="caption" color="text.secondary">by {mod.author}</Typography>
                    </>
                  )}
                  <Typography variant="caption" color="outline.main">·</Typography>
                  <Typography variant="caption" color="text.secondary">{formatSize(mod.size)}</Typography>
                  <Typography variant="caption" color="outline.main">·</Typography>
                  <Typography variant="caption" color="text.secondary">{relativeTime(mod.updatedAt)}</Typography>
                </Box>
              </Box>
              <Tooltip title="Edit metadata">
                <IconButton size="small" onClick={() => handleEditOpen(mod)} sx={{ color: 'text.secondary', flexShrink: 0 }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy raw URL">
                <IconButton size="small" onClick={() => handleCopyUrl(mod)} sx={{ color: 'text.secondary', flexShrink: 0 }}>
                  {copiedId === mod.moduleId ? <CheckIcon fontSize="small" sx={{ color: 'success.main' }} /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              {role !== 'viewer' && (
                <>
                  <Button variant="outlined" size="small" startIcon={<CloudUploadIcon />}
                    onClick={() => handleUploadClick(mod)} sx={{ textTransform: 'none', flexShrink: 0 }}>
                    Upload
                  </Button>
                  <IconButton size="small" onClick={() => setDeleteTarget(mod)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
            );
          })}
        </Box>
      )}

      <Dialog open={uploadOpen} onClose={() => { setUploadOpen(false); setUploadFile(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>{uploadTarget ? `Update "${uploadTarget.moduleId}"` : 'Upload Module'}</DialogTitle>
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
                  <Typography variant="body2" color="text.secondary">Click to select .zip file</Typography>
                </>
              )}
            </Box>
            <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleFileSelect} />
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
        <DialogTitle>Delete module &ldquo;{deleteTarget?.moduleId}&rdquo;?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently remove the module and its raw endpoint.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit &ldquo;{editTarget?.moduleId}&rdquo;</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField autoFocus fullWidth label="Module ID" size="small"
              value={editForm.moduleId}
              onChange={(e) => setEditForm(f => ({ ...f, moduleId: e.target.value }))}
            />
            <TextField fullWidth label="Name" size="small"
              value={editForm.name}
              onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
            <TextField fullWidth label="Version" size="small"
              value={editForm.version}
              onChange={(e) => setEditForm(f => ({ ...f, version: e.target.value }))}
            />
            <TextField fullWidth label="Version code" size="small" type="number"
              value={editForm.versionCode}
              onChange={(e) => setEditForm(f => ({ ...f, versionCode: parseInt(e.target.value, 10) || 1 }))}
            />
            <TextField fullWidth label="Author" size="small"
              value={editForm.author}
              onChange={(e) => setEditForm(f => ({ ...f, author: e.target.value }))}
            />
            <TextField fullWidth label="Description" size="small" multiline maxRows={3}
              value={editForm.description}
              onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={isSavingEdit || !editForm.moduleId.trim()}>
            {isSavingEdit ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
