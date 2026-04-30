import { useEffect, useState, useCallback, useRef } from 'react';
import { snackbar } from 'mdui';
import { useMduiDialog, useMduiInput } from '../../hooks/useMdui';
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

function fileIconName(mimeType: string, isFolder?: boolean): string {
  if (isFolder) return 'folder';
  if (mimeType.startsWith('image/')) return 'image';
  if (/zip|tar|rar|7z/.test(mimeType)) return 'archive';
  if (/json|xml|yaml/.test(mimeType)) return 'data_object';
  return 'description';
}

function fileUrl(id: string): string {
  return `${window.location.origin}/file/${id}`;
}

interface FilesPageProps {
  token: string | null;
}

export default function FilesPage({ token }: FilesPageProps) {
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

  const deleteDialogRef = useMduiDialog(Boolean(deleteTarget), () => setDeleteTarget(null));

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
      snackbar({ message: 'File URL copied', placement: 'bottom', autoCloseDelay: 2000 });
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      snackbar({ message: 'Failed to copy', placement: 'bottom', autoCloseDelay: 2500 });
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteTarget) return;
    const res = await fetch('/.netlify/functions/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: deleteTarget.id }),
    });
    if (res.ok) {
      snackbar({ message: 'Deleted', placement: 'bottom', autoCloseDelay: 2000 });
      fetchFiles();
    } else {
      snackbar({ message: 'Failed to delete', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setDeleteTarget(null);
  }, [token, deleteTarget, fetchFiles]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!token) return;
    const res = await fetch('/.netlify/functions/files?folder=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    });
    if (res.ok) {
      snackbar({ message: 'Folder created', placement: 'bottom', autoCloseDelay: 2000 });
      fetchFiles();
    } else {
      snackbar({ message: (await res.text()) || 'Failed to create folder', placement: 'bottom', autoCloseDelay: 3000 });
    }
  }, [token, currentFolderId, fetchFiles]);

  const uploadFile = useCallback(async (file: File) => {
    if (!token) return;
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
  }, [token, currentFolderId]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      await uploadFile(file);
      snackbar({ message: 'File uploaded', placement: 'bottom', autoCloseDelay: 2000 });
      fetchFiles();
    } catch {
      snackbar({ message: 'Upload failed', placement: 'bottom', autoCloseDelay: 3000 });
    }
    e.target.value = '';
  }, [token, uploadFile, fetchFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(0);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    let ok = 0; let fail = 0;
    for (const f of files) {
      try { await uploadFile(f); ok++; }
      catch { fail++; }
    }
    fetchFiles();
    snackbar({
      message: fail === 0
        ? `${ok} file${ok !== 1 ? 's' : ''} uploaded`
        : `${ok} uploaded, ${fail} failed`,
      placement: 'bottom',
      autoCloseDelay: 3000,
    });
  }, [uploadFile, fetchFiles]);

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
          <mdui-icon name="cloud_upload" style={{ fontSize: 64, color: 'var(--mdui-color-primary)' }} />
          <p className="mdui-typescale-headline-small" style={{ margin: 0, color: 'var(--mdui-color-primary)' }}>
            Drop files here
          </p>
        </div>
      )}

      <div className="page">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <mdui-breadcrumb>
            {folderPath.map((crumb, i) => (
              <mdui-breadcrumb-item
                key={crumb.id || 'root'}
                onClick={() => navigateBreadcrumb(i)}
                style={{
                  cursor: i < folderPath.length - 1 ? 'pointer' : 'default',
                  color: i === folderPath.length - 1
                    ? 'var(--mdui-color-on-surface)'
                    : 'var(--mdui-color-primary)',
                  fontSize: 22,
                }}
              >
                {crumb.name}
              </mdui-breadcrumb-item>
            ))}
          </mdui-breadcrumb>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <mdui-button
              variant="outlined"
              icon="create_new_folder"
              onClick={() => setFolderOpen(true)}
            >
              Folder
            </mdui-button>
            <mdui-button variant="tonal" icon="upload" onClick={() => setUploadOpen(true)}>
              Upload
            </mdui-button>
          </div>
        </div>

        {visibleItems.length > 0 && (
          <div className="meta-row" style={{ marginBottom: 16 }}>
            {hasParent && (
              <mdui-button-icon icon="arrow_back" onClick={goBack} />
            )}
            <span
              className="mdui-typescale-body-small"
              style={{ color: 'var(--mdui-color-on-surface-variant)' }}
            >
              {[
                folderCount > 0 && `${folderCount} folder${folderCount > 1 ? 's' : ''}`,
                fileCount   > 0 && `${fileCount} file${fileCount > 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
              {visibleItems.length > 0 && ` · ${formatSize(totalSize)} total`}
            </span>
          </div>
        )}

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <mdui-skeleton key={i} style={{ height: 52, borderRadius: 'var(--mdui-shape-corner-small)', display: 'block' }} />
            ))}
          </div>
        ) : visibleItems.length === 0 && !hasParent ? (
          <div className="empty-state">
            <mdui-icon name="cloud_upload" style={{ fontSize: 64, color: 'var(--mdui-color-outline)' }} />
            <p className="mdui-typescale-headline-small" style={{ margin: 0 }}>No files yet</p>
            <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
              Upload a file or drop files anywhere on this page.
            </p>
            <mdui-button variant="tonal" icon="upload" onClick={() => setUploadOpen(true)}>
              Upload your first file
            </mdui-button>
          </div>
        ) : visibleItems.length === 0 && hasParent ? (
          <p className="mdui-typescale-body-medium" style={{ color: 'var(--mdui-color-on-surface-variant)', textAlign: 'center', padding: '32px 0' }}>
            This folder is empty
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visibleItems.map(file => (
              <div
                key={file.id}
                className={`file-row${file.isFolder ? ' file-row--folder' : ''}`}
                onClick={() => file.isFolder && enterFolder(file.id, file.name)}
              >
                <mdui-icon
                  name={fileIconName(file.mimeType, file.isFolder)}
                  style={{
                    fontSize: 20,
                    color: file.isFolder ? 'var(--mdui-color-primary)' : 'var(--mdui-color-on-surface-variant)',
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="mdui-typescale-body-medium" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </p>
                  {!file.isFolder && (
                    <div className="file-meta">
                      <span className="mdui-typescale-body-small" style={{ color: 'var(--mdui-color-on-surface-variant)' }}>
                        {formatSize(file.size)}
                      </span>
                      <span style={{ color: 'var(--mdui-color-outline-variant)' }}>·</span>
                      <span className="mdui-typescale-body-small" style={{ color: 'var(--mdui-color-on-surface-variant)' }}>
                        {relativeTime(file.createdAt)}
                      </span>
                    </div>
                  )}
                </div>

                {!file.isFolder && (
                  <mdui-tooltip content="Copy raw URL">
                    <mdui-button-icon
                      icon={copiedId === file.id ? 'check' : 'content_copy'}
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCopyUrl(file.id); }}
                      style={copiedId === file.id ? { color: 'var(--mdui-color-primary)' } : undefined}
                    />
                  </mdui-tooltip>
                )}

                <mdui-tooltip content="Delete">
                  <mdui-button-icon
                    icon="delete_outline"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDeleteTarget(file); }}
                    style={{ color: 'var(--mdui-color-on-surface-variant)' }}
                  />
                </mdui-tooltip>
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
        onUploaded={() => { setUploadOpen(false); fetchFiles(); }}
      />

      <CreateFolderDialog
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      <mdui-dialog
        ref={deleteDialogRef}
        headline={`Delete ${deleteTarget?.isFolder ? 'folder' : 'file'} "${deleteTarget?.name}"?`}
        icon="delete_forever"
        close-on-overlay-click
        close-on-esc
      >
        <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
          {deleteTarget?.isFolder
            ? 'This will permanently remove the folder and all its contents.'
            : 'This will permanently remove the file and its raw endpoint.'}
        </p>
        <mdui-button slot="action" variant="text" onClick={() => setDeleteTarget(null)}>
          Cancel
        </mdui-button>
        <mdui-button
          slot="action"
          variant="tonal"
          onClick={handleDelete}
          style={{ color: 'var(--mdui-color-error)' }}
        >
          Delete
        </mdui-button>
      </mdui-dialog>

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
  const [mode,        setMode]        = useState<'file' | 'url'>('file');
  const [url,         setUrl]         = useState('');
  const [fileName,    setFileName]    = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const dialogRef  = useMduiDialog(open, onClose);
  const urlRef     = useMduiInput(url, setUrl);
  const nameRef    = useMduiInput(fileName, setFileName);
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
      snackbar({ message: 'File uploaded from URL', placement: 'bottom', autoCloseDelay: 2500 });
      onUploaded();
    } else {
      snackbar({ message: (await res.text()) || 'Upload failed', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setIsUploading(false);
  }, [token, mode, url, fileName, currentFolderId, onUploaded]);

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
        snackbar({ message: 'File uploaded', placement: 'bottom', autoCloseDelay: 2000 });
        onUploaded();
      } else {
        snackbar({ message: 'Upload failed', placement: 'bottom', autoCloseDelay: 3000 });
      }
    } catch {
      snackbar({ message: 'Upload failed', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setIsUploading(false);
    e.target.value = '';
  }, [token, currentFolderId, onUploaded]);

  return (
    <mdui-dialog ref={dialogRef} headline="Upload File" close-on-overlay-click close-on-esc>
      <div className="field-group">
        <div className="mode-toggle">
          <mdui-button
            variant={mode === 'file' ? 'tonal' : 'outlined'}
            icon="upload_file"
            onClick={() => setMode('file')}
          >
            From disk
          </mdui-button>
          <mdui-button
            variant={mode === 'url' ? 'tonal' : 'outlined'}
            icon="insert_link"
            onClick={() => setMode('url')}
          >
            From URL
          </mdui-button>
        </div>

        {mode === 'url' ? (
          <>
            <mdui-text-field ref={urlRef} variant="outlined" label="File URL" placeholder="https://example.com/file.pdf" />
            <mdui-text-field ref={nameRef} variant="outlined" label="File name (optional)" placeholder="my-file.pdf" />
          </>
        ) : (
          <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
            <mdui-icon name="cloud_upload" style={{ fontSize: 40, color: 'var(--mdui-color-outline)' }} />
            <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
              Click to select a file
            </p>
          </div>
        )}
      </div>

      <mdui-button slot="action" variant="text" onClick={onClose}>Cancel</mdui-button>
      <mdui-button
        slot="action"
        variant="tonal"
        onClick={handleUpload}
        disabled={isUploading || (mode === 'url' && !url.trim())}
      >
        {isUploading ? 'Uploading…' : 'Upload'}
      </mdui-button>

      <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
    </mdui-dialog>
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
  const dialogRef = useMduiDialog(open, onClose);
  const nameRef   = useMduiInput(name, setName);

  const handle = useCallback(() => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
    onClose();
  }, [name, onCreate, onClose]);

  return (
    <mdui-dialog ref={dialogRef} headline="New Folder" close-on-overlay-click close-on-esc>
      <div style={{ marginTop: 8 }}>
        <mdui-text-field
          ref={nameRef}
          variant="outlined"
          label="Folder name"
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handle(); }}
          style={{ width: '100%' }}
        />
      </div>
      <mdui-button slot="action" variant="text" onClick={onClose}>Cancel</mdui-button>
      <mdui-button slot="action" variant="tonal" onClick={handle}>Create</mdui-button>
    </mdui-dialog>
  );
}
