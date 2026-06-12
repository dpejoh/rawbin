import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography,
  Button,
  IconButton,
  Tooltip,
  Checkbox,
  Chip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import ArchiveIcon from '@mui/icons-material/Archive';
import DataObjectIcon from '@mui/icons-material/DataObject';
import { useSnackbar } from 'notistack';
import { relativeTime, formatSize } from '../../utils/time';
import UploadDialog from './UploadDialog';
import CreateFolderDialog from './CreateFolderDialog';

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  isFolder?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Breadcrumb {
  id: string;
  name: string;
}

function fileIcon(mimeType: string, isFolder?: boolean) {
  if (isFolder) return <FolderIcon />;
  if (mimeType.startsWith('image/')) return <ImageIcon />;
  if (/zip|tar|rar|7z/.test(mimeType)) return <ArchiveIcon />;
  if (/json|xml|yaml/.test(mimeType)) return <DataObjectIcon />;
  return <DescriptionIcon />;
}

function fileUrl(id: string): string {
  return `${window.location.origin}/file/${id}`;
}

interface FilesPageProps {
  token: string | null;
  role: string;
}

export default function FilesPage({ token, role }: FilesPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [allItems,    setAllItems]    = useState<FileItem[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [folderPath,  setFolderPath]  = useState<Breadcrumb[]>(() => {
    try {
      const stored = localStorage.getItem('keybox:folderPath');
      if (stored) {
        const parsed = JSON.parse(stored) as Breadcrumb[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [{ id: '', name: 'Files' }];
  });
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [folderOpen,   setFolderOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [copiedId,     setCopiedId]     = useState<string | null>(null);
  const [isDragging,   setIsDragging]   = useState(0);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  const currentFolderId = folderPath[folderPath.length - 1]?.id ?? '';
  const hasParent = currentFolderId !== '';
  const visibleItems = allItems.filter(f => f.parentId === currentFolderId);

  useEffect(() => { localStorage.setItem('keybox:folderPath', JSON.stringify(folderPath)); }, [folderPath]);

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/.netlify/functions/files', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAllItems(await res.json() as FileItem[]);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const enterFolder = useCallback((id: string, name: string) => {
    setFolderPath(prev => [...prev, { id, name }]);
  }, []);

  const navigateBreadcrumb = useCallback((index: number) => {
    setFolderPath(prev => prev.slice(0, index + 1));
  }, []);

  const goBack = useCallback(() => {
    setFolderPath(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const handleCopyUrl = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(fileUrl(id));
      setCopiedId(id);
      enqueueSnackbar('File URL copied', { variant: 'info' });
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      enqueueSnackbar('Failed to copy', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteTarget) return;
    const res = await fetch('/.netlify/functions/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: deleteTarget.id }),
    });
    if (res.ok) {
      setAllItems(prev => prev.filter(f => f.id !== deleteTarget.id));
      enqueueSnackbar('Deleted', { variant: 'success' });
    } else {
      enqueueSnackbar('Failed to delete', { variant: 'error' });
    }
    setDeleteTarget(null);
  }, [token, deleteTarget, enqueueSnackbar]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!token) return;
    const res = await fetch('/.netlify/functions/files?folder=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    });
    if (res.ok) {
      const { id } = await res.json() as { id: string };
      const now = new Date().toISOString();
      setAllItems(prev => [...prev, {
        id, name, mimeType: 'inode/directory', size: 0,
        parentId: currentFolderId, isFolder: true, createdAt: now, updatedAt: now,
      }]);
      enqueueSnackbar('Folder created', { variant: 'success' });
    } else {
      enqueueSnackbar((await res.text()) || 'Failed to create folder', { variant: 'error' });
    }
  }, [token, currentFolderId, enqueueSnackbar]);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (!token) throw new Error('No token');
    const r2Worker = import.meta.env.VITE_R2_WORKER_URL ?? "http://localhost:8787";
    const fileRes = await fetch(`${r2Worker}/upload/files`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: file,
    });
    if (!fileRes.ok) throw new Error('Storage upload failed');
    const { id: blobId, size } = await fileRes.json() as { id: string; size: number };
    const res = await fetch('/.netlify/functions/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: file.name,
        blobId, size,
        mimeType: file.type || 'application/octet-stream',
        parentId: currentFolderId,
      }),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (data.error) throw new Error(String(data.error));
    return data.id as string;
  }, [token, currentFolderId]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const id = await uploadFile(file);
      const now = new Date().toISOString();
      setAllItems(prev => [...prev, {
        id, name: file.name, mimeType: file.type || 'application/octet-stream',
        size: file.size, parentId: currentFolderId, createdAt: now, updatedAt: now,
      }]);
      enqueueSnackbar('File uploaded', { variant: 'success' });
    } catch {
      enqueueSnackbar('Upload failed', { variant: 'error' });
    }
    e.target.value = '';
  }, [token, uploadFile, currentFolderId, enqueueSnackbar]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(0);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    const now = new Date().toISOString();
    let ok = 0; let fail = 0;
    const newItems: FileItem[] = [];
    for (const f of files) {
      try {
        const id = await uploadFile(f);
        newItems.push({
          id, name: f.name, mimeType: f.type || 'application/octet-stream',
          size: f.size, parentId: currentFolderId, createdAt: now, updatedAt: now,
        });
        ok++;
      } catch { fail++; }
    }
    if (newItems.length > 0) setAllItems(prev => [...prev, ...newItems]);
    enqueueSnackbar(
      fail === 0 ? `${ok} file${ok !== 1 ? 's' : ''} uploaded` : `${ok} uploaded, ${fail} failed`,
      { variant: fail === 0 ? 'success' : 'error' },
    );
  }, [uploadFile, currentFolderId, enqueueSnackbar]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize   = visibleItems.reduce((acc, f) => acc + f.size, 0);
  const fileCount   = visibleItems.filter(f => !f.isFolder).length;
  const folderCount = visibleItems.filter(f =>  f.isFolder).length;

  return (
    <Box
      sx={{ position: 'relative', minHeight: '100%' }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragEnter={e => { e.preventDefault(); setIsDragging(n => n + 1); }}
      onDragLeave={e => { e.preventDefault(); setIsDragging(n => n - 1); }}
      onDrop={handleDrop}
    >
      {isDragging > 0 && (
        <Box className="drop-overlay">
          <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ color: 'primary.main' }}>Drop files here</Typography>
        </Box>
      )}

      <Box className="page">
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {folderPath.map((crumb, i) => (
              <span key={crumb.id || 'root'}>
                {i > 0 && <Typography component="span" sx={{ color: 'outline.main', mx: 0.5, fontSize: 22 }}>/</Typography>}
                <Typography
                  component="span"
                  onClick={() => navigateBreadcrumb(i)}
                  sx={{
                    cursor: i < folderPath.length - 1 ? 'pointer' : 'default',
                    color: i === folderPath.length - 1 ? 'text.primary' : 'primary.main',
                    fontSize: 22,
                    fontWeight: 400,
                  }}
                >
                  {crumb.name}
                </Typography>
              </span>
            ))}
          </Box>

          {role !== 'viewer' && (
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CreateNewFolderIcon />}
                onClick={() => setFolderOpen(true)}
                sx={{ textTransform: 'none' }}
              >
                Folder
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon />}
                onClick={() => setUploadOpen(true)}
                sx={{ textTransform: 'none' }}
              >
                Upload
              </Button>
            </Box>
          )}
        </Box>

        {visibleItems.length > 0 && (
          <Box className="meta-row" sx={{ mb: 2 }}>
            {hasParent && (
              <IconButton size="small" onClick={goBack} sx={{ color: 'text.secondary' }}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
              {[
                folderCount > 0 && `${folderCount} folder${folderCount > 1 ? 's' : ''}`,
                fileCount   > 0 && `${fileCount} file${fileCount > 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
              {visibleItems.length > 0 && ` · ${formatSize(totalSize)} total`}
            </Typography>
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
              sx={{ cursor: 'pointer', mr: 1 }}
            />
            {selectMode && (
              <Button
                variant="text"
                size="small"
                onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                sx={{ textTransform: 'none', mr: 1, minWidth: 'auto', fontSize: 12, height: 24, lineHeight: '16px' }}
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
                  setIsBatchDeleting(true);
                  let ok = 0; let fail = 0;
                  for (const id of selectedIds) {
                    try {
                      const res = await fetch('/.netlify/functions/files', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ id }),
                      });
                      if (res.ok) ok++; else fail++;
                    } catch { fail++; }
                  }
                  enqueueSnackbar(`Deleted ${ok} item${ok !== 1 ? 's' : ''}${fail > 0 ? ` (${fail} failed)` : ''}`, { variant: fail === 0 ? 'success' : 'error' });
                  setSelectedIds(new Set());
                  setSelectMode(false);
                  setIsBatchDeleting(false);
                  await fetchFiles();
                }}
                disabled={isBatchDeleting}
                sx={{ textTransform: 'none', height: 24 }}
              >
                {isBatchDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
              </Button>
            )}
          </Box>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Box key={i} className="skeleton" sx={{ height: 52 }} />
            ))}
          </Box>
        ) : visibleItems.length === 0 && !hasParent ? (
          <Box className="empty-state">
            <CloudUploadIcon sx={{ fontSize: 64, color: 'outline.main' }} />
            <Typography variant="h5" sx={{ color: 'text.primary' }}>No files yet</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Upload a file or drop files anywhere on this page.
            </Typography>
            {role !== 'viewer' && (
              <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => setUploadOpen(true)} sx={{ textTransform: 'none' }}>
                Upload your first file
              </Button>
            )}
          </Box>
        ) : visibleItems.length === 0 && hasParent ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
            This folder is empty
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {visibleItems.map(file => (
              <Box
                key={file.id}
                className={`file-row${file.isFolder ? ' file-row--folder' : ''}`}
                onClick={() => file.isFolder && enterFolder(file.id, file.name)}
                sx={{
                  gap: 1,
                  borderRadius: '8px',
                  bgcolor: selectedIds.has(file.id)
                    ? 'rgba(168,199,250,0.12)'
                    : file.isFolder
                      ? 'surfaceContainerHigh.main'
                      : 'surfaceContainer.main',
                  cursor: file.isFolder ? 'pointer' : 'default',
                  '&:hover': {
                    bgcolor: selectedIds.has(file.id)
                      ? 'rgba(168,199,250,0.12)'
                      : file.isFolder
                        ? 'rgba(168,199,250,0.08)'
                        : 'surfaceContainerHigh.main',
                  },
                }}
              >
                <Box sx={{ width: 36, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                  {selectMode && (
                    <Checkbox
                      checked={selectedIds.has(file.id)}
                      onChange={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(file.id)) next.delete(file.id); else next.add(file.id);
                          return next;
                        });
                      }}
                      size="small"
                      sx={{ p: 0.5 }}
                    />
                  )}
                </Box>
                <Box component="span" sx={{ color: file.isFolder ? 'primary.main' : 'text.secondary', display: 'flex' }}>
                  {fileIcon(file.mimeType, file.isFolder)}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ color: 'text.primary' }}>
                    {file.name}
                  </Typography>
                  {!file.isFolder && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatSize(file.size)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'outline.main' }}>·</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {relativeTime(file.createdAt)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {!file.isFolder && (
                  <Tooltip title="Copy raw URL">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleCopyUrl(file.id); }}
                      sx={{ color: 'text.secondary' }}
                    >
                      {copiedId === file.id ? <CheckIcon fontSize="small" sx={{ color: 'success.main' }} /> : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}

                {role !== 'viewer' && (
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); }}
                      sx={{ color: 'text.secondary' }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <UploadDialog
        open={uploadOpen}
        token={token}
        currentFolderId={currentFolderId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => setUploadOpen(false)}
      />

      <CreateFolderDialog
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {deleteTarget?.isFolder ? 'folder' : 'file'} &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {deleteTarget?.isFolder
              ? 'This will permanently remove the folder and all its contents.'
              : 'This will permanently remove the file and its raw endpoint.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} variant="text">Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
    </Box>
  );
}
