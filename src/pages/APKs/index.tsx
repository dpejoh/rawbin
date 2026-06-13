import { useEffect, useState, useCallback, useRef } from 'react';
import { Trash2, Pencil, Copy, Check, Smartphone, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import PageLayout from '../../components/PageLayout';
import SearchInput from '../../components/SearchInput';
import EmptyState from '../../components/EmptyState';
import useAPKs from '../../hooks/useAPKs';
import { relativeTime, formatSize } from '../../utils/time';
import { parseAPK } from '../../utils/parseAPK';
import { guessAppName } from '../../utils/guessAppName';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<APK | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  useEffect(() => { if (token) fetchAll(token); }, [token, fetchAll]);

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

  const handleUploadClick = useCallback((apk: APK) => {
    setUploadTarget(apk);
    setUploadFile(null);
    setUploadOpen(true);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadFile(file);
    e.target.value = '';
  }, []);

  const handleUpload = useCallback(async () => {
    if (!token || !uploadFile || !uploadTarget) return;
    setIsUploadingFile(true);
    const parsed = await parseAPK(uploadFile);
    const metadata = {
      packageName: uploadTarget.packageName,
      appName: uploadTarget.appName,
      versionCode: parsed ? parsed.versionCode : uploadTarget.versionCode,
      versionName: parsed ? parsed.versionName : uploadTarget.versionName,
    };
    const result = await upload(token, uploadFile, metadata);
    if (result) {
      toast.success(`"${uploadTarget.packageName}" updated`);
      setUploadOpen(false);
      setUploadFile(null);
      setUploadTarget(null);
      await fetchAll(token);
    } else toast.error('Update failed');
    setIsUploadingFile(false);
  }, [token, uploadFile, uploadTarget, upload, fetchAll]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!token) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (!file.name.endsWith('.apk') && !file.name.endsWith('.apks')) {
        toast.warning(`Skipped "${file.name}" — only .apk/.apks files supported`);
        continue;
      }
      setIsUploading(true);
      const parsed = await parseAPK(file);
      const pkgName = parsed
        ? parsed.packageName
        : file.name.replace(/\.apks?$/i, '').replace(/[_-]\d+.*$/, '').trim();
      const metadata = {
        packageName: pkgName,
        appName: guessAppName(pkgName),
        versionCode: parsed ? parsed.versionCode : 0,
        versionName: parsed ? parsed.versionName : '',
      };
      const result = await upload(token, file, metadata);
      if (result) toast.success(`"${metadata.packageName}" uploaded`);
      else toast.error(`"${metadata.packageName}" upload failed`);
      setIsUploading(false);
    }
    await fetchAll(token);
  }, [token, upload, fetchAll]);

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
      toast.error('Only .apk/.apks files are supported');
      return;
    }
    const parsed = await parseAPK(file);
    const pkgName = parsed
      ? parsed.packageName
      : file.name.replace(/\.apks?$/i, '').replace(/[_-]\d+.*$/, '').trim();
    const metadata = {
      packageName: pkgName, appName: guessAppName(pkgName),
      versionCode: parsed ? parsed.versionCode : 0, versionName: parsed ? parsed.versionName : '',
    };
    const result = await upload(token, file, metadata);
    if (result) { toast.success('APK uploaded'); await fetchAll(token); }
    else toast.error('Upload failed');
  }, [token, upload, fetchAll]);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteTarget) return;
    const ok = await remove(token, deleteTarget.id);
    if (ok) { toast.success(`APK "${deleteTarget.packageName}" deleted`); await fetchAll(token); }
    else toast.error('Delete failed');
    setDeleteTarget(null);
  }, [token, deleteTarget, remove, fetchAll]);

  const handleCopyUrl = useCallback(async (apk: APK) => {
    const url = `https://rawbin.dpejoh.com/raw/apks/${encodeURIComponent(`${apk.packageName}.apk`)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(apk.packageName);
      toast('Raw URL copied');
      setTimeout(() => setCopiedId(null), 1500);
    } catch { toast.error('Failed to copy'); }
  }, []);

  const handleEditOpen = useCallback((apk: APK) => {
    setEditTarget(apk);
    setEditForm({
      packageName: apk.packageName, appName: apk.appName,
      versionCode: apk.versionCode, versionName: apk.versionName,
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!token || !editTarget) return;
    const { packageName, appName, versionCode, versionName } = editForm;
    if (!packageName.trim()) { toast.error('Package name is required'); return; }
    setIsSavingEdit(true);
    try {
      const res = await fetch('/api/apks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editTarget.packageName, packageName, appName, versionCode, versionName }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (data.error) toast.error(String(data.error));
      else { toast.success('APK metadata updated'); setEditTarget(null); await fetchAll(token); }
    } catch { toast.error('Failed to save'); }
    setIsSavingEdit(false);
  }, [token, editTarget, editForm, fetchAll]);

  const handleBulkDelete = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    let ok = 0; let fail = 0;
    for (const pkg of selectedIds) {
      const res = await remove(token, pkg);
      if (res) ok++; else fail++;
    }
    toast(fail === 0 ? `Deleted ${ok} APK${ok !== 1 ? 's' : ''}` : `${ok} deleted, ${fail} failed`);
    setSelectedIds(new Set()); setSelectMode(false); setIsBatchDeleting(false);
    await fetchAll(token);
  }, [token, selectedIds, remove, fetchAll]);

  return (
    <PageLayout title="APKs" count={`${apks.length} package${apks.length !== 1 ? 's' : ''}`} maxWidth="lg"
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleDrop}
    >
      {role !== 'viewer' && (
        <div
          className={`border-2 border-dashed rounded-xl p-3 mb-4 text-center cursor-pointer transition-colors hover:border-primary ${isUploading ? 'opacity-60' : ''}`}
          onClick={() => dropInputRef.current?.click()}
        >
          <Upload className="size-7 text-muted-foreground mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">
            {isUploading ? 'Uploading...' : 'Drop .apk/.apks files here or click to upload'}
          </p>
          <input ref={dropInputRef} type="file" accept=".apk,.apks" multiple className="hidden" onChange={handleDropZoneFiles} />
        </div>
      )}

      <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by package name or app name..."
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge
          variant={selectMode ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => { if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); } else setSelectMode(true); }}
        >
          {selectMode ? `${selectedIds.size} selected` : 'Select'}
        </Badge>
        {selectMode && (
          <>
            <Button variant="ghost" size="sm" className="text-xs"
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
              Cancel
            </Button>
            {role !== 'viewer' && selectedIds.size > 0 && (
              <Button variant="destructive" size="sm"
                onClick={handleBulkDelete} disabled={isBatchDeleting}>
                <Trash2 className="size-4 mr-1" />
                {isBatchDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
              </Button>
            )}
          </>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
        </div>
      ) : displayEntries.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="size-12" />}
          title={searchQuery ? 'No matching APKs' : 'No APKs yet'}
          description={searchQuery ? 'Try a different search term' : 'Upload an APK file to get started'}
        />
      ) : (
        <>
          <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground flex-wrap">
            <span className="font-medium mr-1">Sort:</span>
            {([['packageName','Package'],['appName','App Name'],['versionCode','Version'],['updatedAt','Updated']] as const).map(([field,label]) => (
              <button key={field}
                className={`px-2 py-0.5 rounded transition-colors ${sortBy === field ? 'bg-primary/10 text-primary font-semibold' : 'hover:text-foreground'}`}
                onClick={() => {
                  if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                  else { setSortBy(field); setSortOrder(field === 'updatedAt' ? 'desc' : 'asc'); }
                }}
              >
                {label}{sortBy === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto space-y-2">
            {displayEntries.map(apk => {
              const isSelected = selectedIds.has(apk.packageName);
              return (
                <div key={apk.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isSelected ? 'bg-primary/10' : 'bg-card hover:bg-accent border border-border'}`}
                >
                  <div className="size-9 shrink-0 flex items-center justify-center">
                    {selectMode ? (
                      <Checkbox checked={isSelected}
                        onCheckedChange={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(apk.packageName)) next.delete(apk.packageName);
                            else next.add(apk.packageName);
                            return next;
                          });
                        }}
                      />
                    ) : (
                      <Smartphone className="size-6 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{apk.appName}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono">{apk.packageName}</span>
                      <span>·</span>
                      <span>v{apk.versionName || apk.versionCode}</span>
                      {apk.versionCode > 0 && <span>(code {apk.versionCode})</span>}
                      <span>·</span>
                      <span>{formatSize(apk.size)}</span>
                      <span>·</span>
                      <span>{relativeTime(apk.updatedAt)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleEditOpen(apk)} className="text-muted-foreground hover:text-foreground p-1 shrink-0" title="Edit metadata" aria-label="Edit metadata">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => handleCopyUrl(apk)} className="text-muted-foreground hover:text-foreground p-1 shrink-0" title="Copy raw URL" aria-label="Copy raw URL">
                    {copiedId === apk.packageName ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                  </button>
                  {role !== 'viewer' && (
                    <>
                      <button onClick={() => handleUploadClick(apk)} className="text-muted-foreground hover:text-foreground p-1 shrink-0" title="Upload new version" aria-label="Upload new version">
                        <Upload className="size-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(apk)} className="text-muted-foreground hover:text-destructive p-1 shrink-0" title="Delete" aria-label="Delete">
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!v) { setUploadOpen(false); setUploadFile(null); } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Update &ldquo;{uploadTarget?.packageName}&rdquo;</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div
              className={`border border-dashed border-muted-foreground rounded-lg p-4 text-center cursor-pointer transition-colors ${uploadFile ? 'bg-primary/5' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadFile ? (
                <p className="text-sm">{uploadFile.name}</p>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm text-muted-foreground">Click to select .apk/.apks file</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".apk,.apks" className="hidden" onChange={handleFileSelect} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadFile(null); }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || isUploadingFile}>
              {isUploadingFile ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete APK &ldquo;{deleteTarget?.packageName}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently remove the APK and its raw endpoint.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Edit &ldquo;{editTarget?.packageName}&rdquo;</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={editForm.packageName} onChange={(e) => setEditForm(f => ({ ...f, packageName: e.target.value }))} placeholder="Package name" />
            <Input value={editForm.appName} onChange={(e) => setEditForm(f => ({ ...f, appName: e.target.value }))} placeholder="App name" />
            <Input type="number" value={editForm.versionCode} onChange={(e) => setEditForm(f => ({ ...f, versionCode: parseInt(e.target.value, 10) || 0 }))} placeholder="Version code" />
            <Input value={editForm.versionName} onChange={(e) => setEditForm(f => ({ ...f, versionName: e.target.value }))} placeholder="Version name" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={isSavingEdit || !editForm.packageName.trim()}>
              {isSavingEdit ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
