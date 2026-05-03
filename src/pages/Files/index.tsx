import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import ArchiveIcon from '@mui/icons-material/Archive';
import DataObjectIcon from '@mui/icons-material/DataObject';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import { useSnackbar } from 'notistack';
import { relativeTime, formatSize } from '../../utils/time';
import { fileToBase64 } from '../../utils/upload';

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
}

export default function FilesPage({ token }: FilesPageProps) {
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
    const base64 = await fileToBase64(file);
    const res = await fetch('/.netlify/functions/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: file.name,
        content: base64,
        mimeType: file.type || 'application/octet-stream',
        parentId: currentFolderId,
      }),
    });
    if (!res.ok) throw new Error('Upload failed');
    const { id } = await res.json() as { id: string };
    return id;
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
    <div
      style={{ position: 'relative', minHeight: '100%' }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragEnter={e => { e.preventDefault(); setIsDragging(n => n + 1); }}
      onDragLeave={e => { e.preventDefault(); setIsDragging(n => n - 1); }}
      onDrop={handleDrop}
    >
      {isDragging > 0 && (
        <div className="drop-overlay">
          <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ color: 'primary.main' }}>Drop files here</Typography>
        </div>
      )}

      <div className="page">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {folderPath.map((crumb, i) => (
              <span key={crumb.id || 'root'}>
                {i > 0 && <span style={{ color: 'var(--mdui-color-outline, #8E9099)', margin: '0 4px', fontSize: 22 }}>/</span>}
                <span
                  onClick={() => navigateBreadcrumb(i)}
                  style={{
                    cursor: i < folderPath.length - 1 ? 'pointer' : 'default',
                    color: i === folderPath.length - 1 ? 'text.primary' : 'primary.main',
                    fontSize: 22,
                    fontWeight: 400,
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {crumb.name}
                </span>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
          </div>
        </div>

        {visibleItems.length > 0 && (
          <div className="meta-row" style={{ marginBottom: 16 }}>
            {hasParent && (
              <IconButton size="small" onClick={goBack} sx={{ color: 'text.secondary' }}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {[
                folderCount > 0 && `${folderCount} folder${folderCount > 1 ? 's' : ''}`,
                fileCount   > 0 && `${fileCount} file${fileCount > 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
              {visibleItems.length > 0 && ` · ${formatSize(totalSize)} total`}
            </Typography>
          </div>
        )}

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52 }} />
            ))}
          </div>
        ) : visibleItems.length === 0 && !hasParent ? (
          <div className="empty-state">
            <CloudUploadIcon sx={{ fontSize: 64, color: 'outline.main' }} />
            <Typography variant="h5" sx={{ color: 'text.primary' }}>No files yet</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Upload a file or drop files anywhere on this page.
            </Typography>
            <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => setUploadOpen(true)} sx={{ textTransform: 'none' }}>
              Upload your first file
            </Button>
          </div>
        ) : visibleItems.length === 0 && hasParent ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
            This folder is empty
          </Typography>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visibleItems.map(file => (
              <div
                key={file.id}
                className={`file-row${file.isFolder ? ' file-row--folder' : ''}`}
                onClick={() => file.isFolder && enterFolder(file.id, file.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--mdui-color-surface-container, #1E2128)',
                  cursor: file.isFolder ? 'pointer' : 'default',
                }}
              >
                <span style={{ color: file.isFolder ? 'primary.main' : 'text.secondary', display: 'flex' }}>
                  {fileIcon(file.mimeType, file.isFolder)}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ color: 'text.primary' }}>
                    {file.name}
                  </Typography>
                  {!file.isFolder && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatSize(file.size)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'outline.main' }}>·</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {relativeTime(file.createdAt)}
                      </Typography>
                    </div>
                  )}
                </div>

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

                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); }}
                    sx={{ color: 'text.secondary' }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}

/* ─── Upload Dialog ──────────────────────────────────────────────────────── */

interface UploadDialogProps {
  open: boolean;
  token: string | null;
  currentFolderId: string;
  onClose: () => void;
  onUploaded: () => void;
}

function UploadDialog({ open, token, currentFolderId, onClose, onUploaded }: UploadDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [mode,        setMode]        = useState<'file' | 'url'>('file');
  const [url,         setUrl]         = useState('');
  const [fileName,    setFileName]    = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async () => {
    if (!token) return;
    if (mode === 'file') { fileInputRef.current?.click(); return; }
    setIsUploading(true);
    const name = fileName.trim() || `from-url-${Date.now()}`;
    const params = new URLSearchParams({ name, url, parentId: currentFolderId });
    const res = await fetch(`/.netlify/functions/files?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      enqueueSnackbar('File uploaded from URL', { variant: 'success' });
      onUploaded();
    } else {
      enqueueSnackbar((await res.text()) || 'Upload failed', { variant: 'error' });
    }
    setIsUploading(false);
  }, [token, mode, url, fileName, currentFolderId, onUploaded, enqueueSnackbar]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/.netlify/functions/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: file.name,
          content: base64,
          mimeType: file.type || 'application/octet-stream',
          parentId: currentFolderId,
        }),
      });
      if (res.ok) {
        enqueueSnackbar('File uploaded', { variant: 'success' });
        onUploaded();
      } else {
        enqueueSnackbar('Upload failed', { variant: 'error' });
      }
    } catch {
      enqueueSnackbar('Upload failed', { variant: 'error' });
    }
    setIsUploading(false);
    e.target.value = '';
  }, [token, currentFolderId, onUploaded, enqueueSnackbar]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Upload File</DialogTitle>
      <DialogContent>
        <div className="field-group">
          <div className="mode-toggle">
            <Button
              variant={mode === 'file' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<UploadFileIcon />}
              onClick={() => setMode('file')}
              sx={{ textTransform: 'none' }}
            >
              From disk
            </Button>
            <Button
              variant={mode === 'url' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<InsertLinkIcon />}
              onClick={() => setMode('url')}
              sx={{ textTransform: 'none' }}
            >
              From URL
            </Button>
          </div>

          {mode === 'url' ? (
            <>
              <TextField label="File URL" variant="outlined" fullWidth value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/file.pdf" sx={{ mt: 2 }} />
              <TextField label="File name (optional)" variant="outlined" fullWidth value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="my-file.pdf" />
            </>
          ) : (
            <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()} style={{ marginTop: 16 }}>
              <CloudUploadIcon sx={{ fontSize: 40, color: 'outline.main' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Click to select a file</Typography>
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">Cancel</Button>
        <Button onClick={handleUpload} variant="contained" disabled={isUploading || (mode === 'url' && !url.trim())}>
          {isUploading ? 'Uploading\u2026' : 'Upload'}
        </Button>
      </DialogActions>
      <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
    </Dialog>
  );
}

/* ─── Create Folder Dialog ───────────────────────────────────────────────── */

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

function CreateFolderDialog({ open, onClose, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState('');

  const handle = useCallback(() => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
    onClose();
  }, [name, onCreate, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New Folder</DialogTitle>
      <DialogContent>
        <TextField
          label="Folder name"
          variant="outlined"
          fullWidth
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handle(); }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">Cancel</Button>
        <Button onClick={handle} variant="contained" disabled={!name.trim()}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}
