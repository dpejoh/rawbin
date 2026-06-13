import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Download, Plus, Trash2, Pencil, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface AppCatalogEntry {
  packageName: string;
  appName: string;
}

interface AppCatalogProps {
  token: string | null;
  role: string;
}

export default function AppCatalog({ token, role }: AppCatalogProps) {
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
      const res = await fetch('/api/apps');
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
      const res = await fetch('/api/apps/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: addPackageName.trim(), appName: addAppName.trim() }),
      });
      if (res.ok) {
        toast.success(`${addPackageName.trim()} added`);
        setAddDialogOpen(false);
        setAddPackageName('');
        setAddAppName('');
        await fetchCatalog();
      } else {
        toast.error('Failed to add');
      }
    } catch { toast.error('Failed to add'); }
  }, [token, addPackageName, addAppName, fetchCatalog]);

  const handleEdit = useCallback(async () => {
    if (!token || !editPackageName.trim() || !editAppName.trim()) return;
    try {
      if (editOriginalPkg !== editPackageName.trim()) {
        await fetch('/api/apps', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ packageName: editOriginalPkg }),
        });
      }
      const res = await fetch('/api/apps/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: editPackageName.trim(), appName: editAppName.trim() }),
      });
      if (res.ok) {
        toast.success('Entry updated');
        setEditDialogOpen(false);
        await fetchCatalog();
      } else {
        toast.error('Failed to update');
      }
    } catch { toast.error('Failed to update'); }
  }, [token, editOriginalPkg, editPackageName, editAppName, fetchCatalog]);

  const handleDelete = useCallback(async (pkg: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: pkg }),
      });
      if (res.ok) {
        toast.success(`${pkg} deleted`);
        await fetchCatalog();
      } else toast.error('Delete failed');
    } catch { toast.error('Delete failed'); }
  }, [token, fetchCatalog]);

  const handleBulkDelete = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: Array.from(selectedIds) }),
      });
      if (res.ok) {
        toast.success(`Deleted ${selectedIds.size} entries`);
        setSelectedIds(new Set());
        setSelectMode(false);
        await fetchCatalog();
      } else toast.error('Bulk delete failed');
    } catch { toast.error('Bulk delete failed'); }
    finally { setIsDeleting(false); }
  }, [token, selectedIds, fetchCatalog]);

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
      toast.error('No valid entries found');
      setIsImporting(false);
      return;
    }
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(entriesToImport),
      });
      if (res.ok) {
        const result = await res.json() as { imported: number; total: number };
        toast.success(`Imported ${result.imported} entries (${result.total} total)`);
        await fetchCatalog();
      } else toast.error('Import failed');
    } catch { toast.error('Import failed'); }
    finally { setIsImporting(false); }
  }, [token, fetchCatalog]);

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
    <PageLayout title="App Catalog" count={`${entries.length} package${entries.length !== 1 ? 's' : ''}`} maxWidth="lg">

      {role === 'admin' && (
        <div
          className={`border-2 border-dashed rounded-xl p-3 mb-4 text-center cursor-pointer transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/50'
          }`}
          onDrop={handleDrop} onDragOver={handleDragOver}
          onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
          onClick={() => { if (!isImporting) fileInputRef.current?.click(); }}
        >
          <Upload className="size-7 text-muted-foreground mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">
            {isImporting ? 'Importing...' : 'Drop JSON files here to import'}
          </p>
          <input ref={fileInputRef} type="file" accept=".json" multiple className="hidden"
            onChange={e => handleImport(e.target.files)} />
        </div>
      )}

      <div className="flex gap-2 mb-4 items-center">
        {role === 'admin' && (
          <Button onClick={() => { setAddPackageName(''); setAddAppName(''); setAddDialogOpen(true); }}>
            <Plus className="size-4 mr-1" />
            Add Entry
          </Button>
        )}
        <Button variant="outline" onClick={handleExport}>
          <Download className="size-4 mr-1" />
          Export
        </Button>
        <div className="flex-1" />
        <Badge
          variant={selectMode ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => { if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); } else setSelectMode(true); }}
        >
          {selectMode ? `${selectedIds.size} selected` : 'Select'}
        </Badge>
        {selectMode && (
          <Button variant="ghost" size="sm" className="text-xs"
            onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
            Cancel
          </Button>
        )}
        {role === 'admin' && selectMode && selectedIds.size > 0 && (
          <Button variant="destructive" size="sm"
            onClick={handleBulkDelete} disabled={isDeleting}>
            <Trash2 className="size-4 mr-1" />
            {isDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
          </Button>
        )}
      </div>

      <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by package name or app name..."
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
        </div>
      ) : displayEntries.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-12" />}
          title="No packages yet"
          description="Add entries manually or import a JSON file to get started"
        />
      ) : (
        <>
          <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground flex-wrap">
            <span className="font-medium mr-1">Sort:</span>
            {([['packageName','Package Name'],['appName','App Name']] as const).map(([field,label]) => (
              <button key={field}
                className={`px-2 py-0.5 rounded transition-colors ${sortBy === field ? 'bg-primary/10 text-primary font-semibold' : 'hover:text-foreground'}`}
                onClick={() => {
                  if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                  else { setSortBy(field); setSortOrder('asc'); }
                }}
              >
                {label}{sortBy === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto space-y-2">
            {displayEntries.map(entry => {
              const isSelected = selectedIds.has(entry.packageName);
              return (
                <div key={entry.packageName}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isSelected ? 'bg-primary/10' : 'bg-card hover:bg-accent border border-border'}`}
                >
                  <div className="size-9 shrink-0 flex items-center justify-center">
                    {selectMode ? (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelect(entry.packageName)}
                      />
                    ) : (
                      <ListChecks className="size-6 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.appName}</p>
                    <p className="text-xs font-mono text-muted-foreground">{entry.packageName}</p>
                  </div>
                  {role === 'admin' && (
                    <>
                      <button onClick={() => handleOpenEdit(entry)} className="text-muted-foreground hover:text-foreground p-1 shrink-0" title="Edit" aria-label="Edit">
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => handleDelete(entry.packageName)} className="text-muted-foreground hover:text-destructive p-1 shrink-0" title="Delete" aria-label="Delete">
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

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={addPackageName}
              onChange={(e) => setAddPackageName(e.target.value)}
              placeholder="com.example.app"
              onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('add-app-name')?.focus(); }}
            />
            <Input
              id="add-app-name"
              value={addAppName}
              onChange={(e) => setAddAppName(e.target.value)}
              placeholder="Example App"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!addPackageName.trim() || !addAppName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={editPackageName}
              onChange={(e) => setEditPackageName(e.target.value)}
              placeholder="com.example.app"
            />
            <Input
              value={editAppName}
              onChange={(e) => setEditAppName(e.target.value)}
              placeholder="Example App"
              onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editPackageName.trim() || !editAppName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
