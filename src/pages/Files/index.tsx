import { useEffect, useState, useCallback, useRef } from 'react';
import { FolderPlus, ArrowLeft, Copy, Check, Trash2, Folder, FileText, Image, Archive, Code2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  if (isFolder) return <Folder className="size-5 text-primary" />;
  if (mimeType.startsWith('image/')) return <Image className="size-5" />;
  if (/zip|tar|rar|7z/.test(mimeType)) return <Archive className="size-5" />;
  if (/json|xml|yaml/.test(mimeType)) return <Code2 className="size-5" />;
  return <FileText className="size-5" />;
}

function fileUrl(id: string): string {
  return `${window.location.origin}/file/${id}`;
}

interface FilesPageProps {
  token: string | null;
  role: string;
}

export default function FilesPage({ token, role }: FilesPageProps) {
  const [allItems, setAllItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [folderPath, setFolderPath] = useState<Breadcrumb[]>(() => {
    try {
      const stored = localStorage.getItem('keybox:folderPath');
      if (stored) {
        const parsed = JSON.parse(stored) as Breadcrumb[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [{ id: '', name: 'Files' }];
  });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      const res = await fetch('/api/files', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAllItems(await res.json() as FileItem[]);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [token]);

  const handleUploaded = useCallback(async () => {
    setUploadOpen(false);
    await fetchFiles();
  }, [fetchFiles]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const enterFolder = useCallback((id: string, name: string) => {
    setFolderPath(prev => [...prev, { id, name }]);
    setSelectedIds(new Set());
    setSelectMode(false);
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
      toast('File URL copied');
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteTarget) return;
    const res = await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: deleteTarget.id }),
    });
    if (res.ok) {
      toast.success('Deleted');
      await fetchFiles();
    } else {
      toast.error('Failed to delete');
    }
    setDeleteTarget(null);
  }, [token, deleteTarget, fetchFiles]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!token) return;
    const res = await fetch('/api/files?folder=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    });
    if (res.ok) {
      toast.success('Folder created');
      await fetchFiles();
    } else {
      toast.error((await res.text()) || 'Failed to create folder');
    }
  }, [token, currentFolderId, fetchFiles]);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (!token) throw new Error('No token');
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    const fileRes = await fetch(`/upload/files?key=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm,
    });
    if (!fileRes.ok) throw new Error('Storage upload failed');
    const { id: blobId, size } = await fileRes.json() as { id: string; size: number };
    const res = await fetch('/api/files', {
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(0);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    let ok = 0; let fail = 0;
    for (const f of files) {
      try {
        await uploadFile(f);
        ok++;
      } catch { fail++; }
    }
    if (ok > 0) await fetchFiles();
    toast(fail === 0 ? `${ok} file${ok !== 1 ? 's' : ''} uploaded` : `${ok} uploaded, ${fail} failed`);
  }, [uploadFile, currentFolderId, fetchFiles]);

  const totalSize = visibleItems.reduce((acc, f) => acc + f.size, 0);
  const fileCount = visibleItems.filter(f => !f.isFolder).length;
  const folderCount = visibleItems.filter(f => f.isFolder).length;

  return (
    <TooltipProvider>
      <div
        className="relative min-h-full"
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDragEnter={e => { e.preventDefault(); setIsDragging(n => n + 1); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(n => n - 1); }}
        onDrop={handleDrop}
      >
        {isDragging > 0 && (
          <div className="fixed inset-0 z-50 bg-background/80 border-2 border-dashed border-primary rounded-xl m-2 flex flex-col items-center justify-center gap-3">
            <Upload className="size-16 text-primary" />
            <h2 className="text-xl text-primary">Drop files here</h2>
          </div>
        )}

        <div className="p-8 max-w-2xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-0.5 flex-wrap">
              {folderPath.map((crumb, i) => (
                <span key={crumb.id || 'root'}>
                  {i > 0 && <span className="text-muted-foreground mx-1 text-xl">/</span>}
                  <button
                    onClick={() => navigateBreadcrumb(i)}
                    className={`text-xl ${i === folderPath.length - 1 ? 'text-foreground' : 'text-primary hover:underline'} cursor-pointer bg-transparent border-none font-mono`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>

            {role !== 'viewer' && (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setFolderOpen(true)}>
                  <FolderPlus className="size-4 mr-1" />
                  Folder
                </Button>
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="size-4 mr-1" />
                  Upload
                </Button>
              </div>
            )}
          </div>

          {visibleItems.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {hasParent && (
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground p-1">
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <span className="text-xs text-muted-foreground flex-1">
                {[folderCount > 0 && `${folderCount} folder${folderCount > 1 ? 's' : ''}`,
                  fileCount > 0 && `${fileCount} file${fileCount > 1 ? 's' : ''}`,
                ].filter(Boolean).join(' · ')}
                {visibleItems.length > 0 && ` · ${formatSize(totalSize)} total`}
              </span>
              <Badge
                variant={selectMode ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => {
                  if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); }
                  else setSelectMode(true);
                }}
              >
                {selectMode ? `${selectedIds.size} selected` : 'Select'}
              </Badge>
              {selectMode && (
                <Button variant="ghost" size="sm" className="text-xs h-6"
                  onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
                  Cancel
                </Button>
              )}
              {selectMode && selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" className="h-6"
                  onClick={async () => {
                    if (!token || selectedIds.size === 0) return;
                    setIsBatchDeleting(true);
                    let ok = 0; let fail = 0;
                    for (const id of selectedIds) {
                      try {
                        const res = await fetch('/api/files', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ id }),
                        });
                        if (res.ok) ok++; else fail++;
                      } catch { fail++; }
                    }
                    toast(fail === 0 ? `Deleted ${ok} item${ok !== 1 ? 's' : ''}` : `${ok} deleted, ${fail} failed`);
                    setSelectedIds(new Set());
                    setSelectMode(false);
                    setIsBatchDeleting(false);
                    await fetchFiles();
                  }}
                  disabled={isBatchDeleting}>
                  {isBatchDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : visibleItems.length === 0 && !hasParent ? (
            <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
              <Upload className="size-16 text-muted-foreground" />
              <h2 className="text-xl">No files yet</h2>
              <p className="text-sm text-muted-foreground">
                Upload a file or drop files anywhere on this page.
              </p>
              {role !== 'viewer' && (
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload className="size-4 mr-1" />
                  Upload your first file
                </Button>
              )}
            </div>
          ) : visibleItems.length === 0 && hasParent ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              This folder is empty
            </p>
          ) : (
            <div className="space-y-1.5">
              {visibleItems.map(file => (
                <div
                  key={file.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border ${
                    selectedIds.has(file.id) ? 'bg-primary/10 border-primary/30' : 'bg-card hover:bg-accent border-border'
                  } ${file.isFolder ? 'cursor-pointer' : ''}`}
                  onClick={() => file.isFolder && enterFolder(file.id, file.name)}
                >
                  <div className="size-9 shrink-0 flex items-center justify-center">
                    {selectMode ? (
                      <Checkbox
                        checked={selectedIds.has(file.id)}
                        onCheckedChange={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(file.id)) next.delete(file.id); else next.add(file.id);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-muted-foreground shrink-0">
                        {fileIcon(file.mimeType, file.isFolder)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.name}</p>
                    {!file.isFolder && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{formatSize(file.size)}</span>
                        <span>·</span>
                        <span>{relativeTime(file.createdAt)}</span>
                      </div>
                    )}
                  </div>
                  {!file.isFolder && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyUrl(file.id); }}
                          className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                          title="Copy raw URL" aria-label="Copy raw URL"
                        >
                          {copiedId === file.id ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Copy raw URL</TooltipContent>
                    </Tooltip>
                  )}
                  {role !== 'viewer' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); }}
                          className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                          title="Delete" aria-label="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  )}
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
          onUploaded={handleUploaded}
        />

        <CreateFolderDialog
          open={folderOpen}
          onClose={() => setFolderOpen(false)}
          onCreate={handleCreateFolder}
        />

        <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>
                Delete {deleteTarget?.isFolder ? 'folder' : 'file'} &ldquo;{deleteTarget?.name}&rdquo;?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {deleteTarget?.isFolder
                ? 'This will permanently remove the folder and all its contents.'
                : 'This will permanently remove the file and its raw endpoint.'}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
