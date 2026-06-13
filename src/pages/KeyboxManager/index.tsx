import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Upload, History, Shield,
  Loader2, RefreshCw, Search,
} from 'lucide-react';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PageLayout from '../../components/PageLayout';
import SearchInput from '../../components/SearchInput';
import EmptyState from '../../components/EmptyState';
import KeyboxRow from './KeyboxRow';
import AddKeyboxDialog from './AddKeyboxDialog';
import XmlImportDialog from './XmlImportDialog';
import AutoOverrideDialog from './AutoOverrideDialog';
import type { HistoryEntry, StatusType } from './types';

interface KeyboxManagerProps {
  token: string | null;
  role: string;
}

export default function KeyboxManager({ token, role }: KeyboxManagerProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const [recheckingKey, setRecheckingKey] = useState<string | null>(null);
  const [settingStatusKey, setSettingStatusKey] = useState<string | null>(null);

  const [contentCache, setContentCache] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});

  const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
  const [xmlItems, setXmlItems] = useState<Array<{ filename: string; content: string; version: string; text: string; source: string }>>([]);

  const [sortBy, setSortBy] = useState<'timestamp' | 'source' | 'version'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideSource, setOverrideSource] = useState('');
  const [overrideVersion, setOverrideVersion] = useState('');
  const [autoOverride, setAutoOverride] = useState<{ source: string; version?: string } | null>(null);
  const [latestPerSource, setLatestPerSource] = useState<Record<string, string>>({});

  const entryKey = (e: HistoryEntry) => `${e.source}:${e.version}`;

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const data = await res.json() as { entries: HistoryEntry[]; latest: Record<string, string>; autoOverride?: { source: string; version?: string } | null };
        const list = Array.isArray(data) ? data as HistoryEntry[] : data.entries;
        setEntries(list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
        const unique = [...new Set(list.map(e => e.source))].sort();
        setSources(unique);
        if (data.latest) setLatestPerSource(data.latest);
        setAutoOverride(data.autoOverride ?? null);
      }
    } catch { }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const loadContent = useCallback(async (key: string) => {
    if (contentCache[key] || loadingContent[key]) return;
    setLoadingContent(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/catalog?v=${key}`);
      if (res.ok) {
        const text = await res.text();
        setContentCache(prev => ({ ...prev, [key]: text }));
      }
    } catch { }
    finally { setLoadingContent(prev => ({ ...prev, [key]: false })); }
  }, [contentCache, loadingContent]);

  const handleExpand = useCallback((entry: HistoryEntry) => {
    const key = entryKey(entry);
    if (expandedKey === key) {
      setExpandedKey(null);
    } else {
      setExpandedKey(key);
      loadContent(key);
    }
  }, [expandedKey, loadContent]);

  const handleImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !token) return;
    setIsImporting(true);
    const jsonImportData: Array<{ source: string; version: string; content: string; text?: string }> = [];
    const xmlImportItems: Array<{ filename: string; content: string; version: string; text: string }> = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (item.version && item.content && item.source) {
              jsonImportData.push({ source: item.source, version: item.version, content: item.content, text: item.text });
            }
          }
        } else if (file.name.endsWith('.xml')) {
          xmlImportItems.push({ filename: file.name, content: text, version: '', text: '' });
        }
      } catch { }
    }
    let imported = 0;
    if (jsonImportData.length > 0) {
      try {
        const res = await fetch('/api/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(jsonImportData),
        });
        if (res.ok) {
          const result = await res.json() as { imported: number; results: Array<{ source: string; version: string; status: string }> };
          imported = result.results.filter(r => r.status === 'ok').length;
          const skipped = result.results.filter(r => r.status !== 'ok').length;
          if (imported > 0) toast.success(`Imported ${imported} keybox${imported !== 1 ? 'es' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
        } else toast.error('JSON import failed');
      } catch { toast.error('JSON import failed'); }
    }
    if (xmlImportItems.length > 0) {
      setXmlItems(xmlImportItems.map(f => ({ ...f, source: '' })));
      setXmlDialogOpen(true);
    }
    if (jsonImportData.length === 0 && xmlImportItems.length === 0) {
      toast.error('No valid keyboxes found in selection');
    }
    setIsImporting(false);
    if (imported > 0) {
      setContentCache({});
      await fetchHistory();
    }
  }, [token, fetchHistory]);

  const handleXmlImport = useCallback(async () => {
    if (!token || xmlItems.length === 0) return;
    setIsImporting(true);
    const valid = xmlItems.filter(item => item.source);
    if (valid.length === 0) {
      toast.error('All items need a provider');
      setIsImporting(false);
      return;
    }
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(valid.map(item => ({ source: item.source, version: item.version, text: item.text, content: item.content }))),
      });
      if (res.ok) {
        const result = await res.json() as { imported: number; results: Array<{ source: string; version: string; status: string }> };
        const ok = result.results.filter(r => r.status === 'ok').length;
        const skipped = result.results.filter(r => r.status !== 'ok').length;
        toast.success(`Imported ${ok} keybox${ok !== 1 ? 'es' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
        setXmlDialogOpen(false);
        setContentCache({});
        await fetchHistory();
      } else toast.error('Import failed');
    } catch { toast.error('Import failed'); }
    finally { setIsImporting(false); }
  }, [token, xmlItems, fetchHistory]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); dragCounter.current = 0;
    handleImport(e.dataTransfer.files);
  }, [handleImport]);
  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const handleDragEnter = useCallback(() => { dragCounter.current++; setDragging(true); }, []);
  const handleDragLeave = useCallback(() => { dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }, []);

  const filtered = [...entries].filter(e => {
    if (sourceFilter && e.source !== sourceFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return e.version.includes(q) || e.serial.includes(q) || e.source.includes(q);
    }
    return true;
  }).sort((a, b) => {
    const asc = sortOrder === 'asc';
    if (sortBy === 'timestamp') return asc
      ? a.timestamp.localeCompare(b.timestamp)
      : b.timestamp.localeCompare(a.timestamp);
    if (sortBy === 'source') return asc
      ? a.source.localeCompare(b.source)
      : b.source.localeCompare(a.source);
    if (sortBy === 'version') {
      const na = parseInt(a.version, 10);
      const nb = parseInt(b.version, 10);
      if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
      return asc
        ? a.version.localeCompare(b.version)
        : b.version.localeCompare(a.version);
    }
    return 0;
  });

  const handleDelete = useCallback(async (entry: HistoryEntry) => {
    if (!token) return;
    try {
      const res = await fetch('/api/catalog', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: entry.source, version: entry.version }),
      });
      if (res.ok) {
        toast.success(`${entry.source} v${entry.version} deleted`);
        const key = entryKey(entry);
        if (expandedKey === key) setExpandedKey(null);
        setContentCache(prev => { const n = { ...prev }; delete n[key]; return n; });
        await fetchHistory();
      } else toast.error('Delete failed');
    } catch { toast.error('Delete failed'); }
    setDeleteTarget(null);
  }, [token, fetchHistory, expandedKey]);

  const handleBatchDelete = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    setIsDeleting(true);
    let ok = 0; let fail = 0;
    for (const entry of entries.filter(e => selectedIds.has(entryKey(e)))) {
      try {
        const res = await fetch('/api/catalog', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ source: entry.source, version: entry.version }),
        });
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }
    toast.success(`Deleted ${ok} entry${ok !== 1 ? 'es' : ''}${fail > 0 ? ` (${fail} failed)` : ''}`);
    setSelectedIds(new Set());
    setSelectMode(false);
    setIsDeleting(false);
    setContentCache({});
    await fetchHistory();
  }, [token, entries, selectedIds, fetchHistory]);

  const handleRecheck = useCallback(async (entry: HistoryEntry) => {
    if (!token) return;
    const key = entryKey(entry);
    setRecheckingKey(key);
    try {
      const res = await fetch(`/api/catalog?recheck=${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(`${entry.source} v${entry.version} re-checked`);
        setContentCache({});
        await fetchHistory();
      } else toast.error('Re-check failed');
    } catch { toast.error('Re-check failed'); }
    finally { setRecheckingKey(null); }
  }, [token, fetchHistory]);

  const handleSetStatus = useCallback(async (entry: HistoryEntry, status: StatusType) => {
    if (!token) return;
    const key = entryKey(entry);
    setSettingStatusKey(key);
    try {
      const res = await fetch('/api/catalog/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ serial: entry.serial, status }),
      });
      if (res.ok) {
        const data = await res.json() as { updated: number };
        toast.success(`${data.updated} entr${data.updated !== 1 ? 'ies' : 'y'} with serial ${entry.serial.slice(0, 12)}… → ${status}`);
        setContentCache({});
        await fetchHistory();
      } else {
        const msg = await res.text().then(t => { try { return JSON.parse(t).error; } catch { return t; } }).catch(() => 'Set status failed');
        toast.error(msg);
      }
    } catch { toast.error('Set status failed'); }
    finally { setSettingStatusKey(null); }
  }, [token, fetchHistory]);

  const handleAddKeybox = useCallback(async (data: { source: string; version: string; text: string; content: string; useBase64: boolean }) => {
    if (!token) return;
    try {
      const res = await fetch('/api/catalog/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, version: data.version || '1' }),
      });
      if (res.ok) {
        toast.success('Keybox added');
        setContentCache({});
        await fetchHistory();
      } else {
        const msg = await res.text().catch(() => 'Failed to add');
        toast.error(msg);
      }
    } catch { toast.error('Failed to add'); }
  }, [token, fetchHistory]);

  const handleEditSave = useCallback(async (entry: HistoryEntry, data: { source: string; version: string; text: string; content: string; useBase64: boolean }) => {
    if (!token) return;
    const srcChanged = data.source !== entry.source;
    try {
      if (srcChanged) {
        const delRes = await fetch('/api/catalog', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ source: entry.source, version: entry.version }),
        });
        if (!delRes.ok) { toast.error('Failed to replace old entry'); return; }
      }
      const saveRes = await fetch('/api/catalog/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (saveRes.ok) {
        toast.success('Entry updated');
        setContentCache(prev => {
          const n = { ...prev };
          delete n[entryKey(entry)];
          return n;
        });
        setExpandedKey(`${data.source}:${data.version}`);
        await fetchHistory();
      } else toast.error('Failed to save entry');
    } catch { toast.error('Failed to save entry'); }
  }, [token, fetchHistory]);

  const handleSetAutoOverride = useCallback(async () => {
    if (!token || !overrideSource) return;
    try {
      const res = await fetch('/api/catalog/set-auto-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: overrideSource, version: overrideVersion || undefined }),
      });
      if (res.ok) {
        toast.success('Auto-override set');
        setOverrideDialogOpen(false);
        setContentCache({});
        await fetchHistory();
      } else toast.error('Failed to set override');
    } catch { toast.error('Failed to set override'); }
  }, [token, overrideSource, overrideVersion, fetchHistory]);

  const handleClearAutoOverride = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/catalog/clear-auto-override', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Auto-override cleared');
        setContentCache({});
        await fetchHistory();
      } else toast.error('Failed to clear override');
    } catch { toast.error('Failed to clear override'); }
  }, [token, fetchHistory]);

  return (
    <PageLayout title="Keyboxes" count={`${entries.length} keybox${entries.length !== 1 ? 'es' : ''}`} maxWidth="md">
      {role === 'admin' && (
        <div
          className={`border-2 border-dashed rounded-xl p-3 mb-4 text-center cursor-pointer transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
          }`}
          onDrop={handleDrop} onDragOver={handleDragOver}
          onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-6 text-muted-foreground mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">{isImporting ? 'Importing...' : 'Drop XML or JSON files to import'}</p>
          <input ref={fileInputRef} type="file" accept=".xml,.json" multiple className="hidden"
            onChange={e => handleImport(e.target.files)} />
          {isImporting && <Loader2 className="size-4 animate-spin mx-auto mt-1 text-muted-foreground" />}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {role === 'admin' && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4 mr-1" />
            Add
          </Button>
        )}
        <Button variant="outline" size="sm"
          onClick={() => { setOverrideSource(autoOverride?.source || ''); setOverrideVersion(autoOverride?.version || ''); setOverrideDialogOpen(true); }}>
          <RefreshCw className="size-3.5 mr-1" />
          {autoOverride ? `Override: ${autoOverride.source}` : 'Auto Override'}
        </Button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <Badge variant={sourceFilter === null ? 'default' : 'outline'} className="cursor-pointer"
          onClick={() => setSourceFilter(null)}>
          All
        </Badge>
        {sources.map(s => (
          <Badge key={s} variant={sourceFilter === s ? 'default' : 'outline'} className="cursor-pointer"
            onClick={() => setSourceFilter(sourceFilter === s ? null : s)}>
            {s}
          </Badge>
        ))}
        <div className="flex-1" />
        <Badge
          variant={selectMode ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => { if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); } else setSelectMode(true); }}
        >
          {selectMode ? `${selectedIds.size} selected` : 'Select'}
        </Badge>
        {selectMode && (
          <>
            <Button variant="ghost" size="sm" className="text-xs h-6"
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
              Cancel
            </Button>
            {role === 'admin' && selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" className="h-6"
                onClick={handleBatchDelete} disabled={isDeleting}>
                <Trash2 className="size-3.5 mr-1" />
                {isDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
              </Button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium mr-1">Sort:</span>
        {([['timestamp','Date'],['source','Source'],['version','Version']] as const).map(([field,label]) => (
          <button key={field}
            className={`px-2 py-0.5 rounded transition-colors ${sortBy === field ? 'bg-primary/10 text-primary font-semibold' : 'hover:text-foreground'}`}
            onClick={() => {
              if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
              else { setSortBy(field as 'timestamp' | 'source' | 'version'); setSortOrder('desc'); }
            }}
          >
            {label}{sortBy === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by version, serial, or source..."
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[72px] w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<History className="size-12" />}
          title={searchQuery || sourceFilter ? 'No matching keyboxes' : 'No keyboxes yet'}
          description={
            searchQuery || sourceFilter
              ? 'Try a different search term or filter'
              : 'Import keyboxes or use Add Keybox to get started'
          }
          action={role === 'admin' && !searchQuery && !sourceFilter ? { label: 'Add Keybox', onClick: () => setAddDialogOpen(true) } : undefined}
        />
      ) : (
        <div className="flex-1 overflow-auto flex flex-col gap-2">
          {filtered.map(entry => {
            const key = entryKey(entry);
            return (
              <KeyboxRow
                key={key}
                entry={entry}
                isSelected={selectedIds.has(key)}
                selectMode={selectMode}
                content={contentCache[key] ?? null}
                isLoadingContent={loadingContent[key] ?? false}
                expanded={expandedKey === key}
                role={role}
                token={token}
                sources={sources}
                onToggleSelect={(e) => {
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    const k = entryKey(e);
                    if (next.has(k)) next.delete(k); else next.add(k);
                    return next;
                  });
                }}
                onExpand={handleExpand}
                onDelete={(e) => setDeleteTarget(e)}
                onRecheck={handleRecheck}
                onSetStatus={handleSetStatus}
                onEditSave={handleEditSave}
                isSettingStatus={settingStatusKey === key}
                isRechecking={recheckingKey === key}
              />
            );
          })}
        </div>
      )}

      <AddKeyboxDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        sources={sources}
        onSave={handleAddKeybox}
      />

      <XmlImportDialog
        open={xmlDialogOpen}
        onOpenChange={(v) => { if (!v) { setXmlDialogOpen(false); setXmlItems([]); } }}
        items={xmlItems}
        onUpdateItem={(i, item) => setXmlItems(prev => prev.map((x, j) => j === i ? item : x))}
        sources={sources}
        onImport={handleXmlImport}
        isImporting={isImporting}
      />

      <AutoOverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        sources={sources}
        overrideSource={overrideSource}
        overrideVersion={overrideVersion}
        onOverrideSourceChange={setOverrideSource}
        onOverrideVersionChange={setOverrideVersion}
        onSave={handleSetAutoOverride}
        onClear={handleClearAutoOverride}
        hasExisting={autoOverride !== null}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.source} v{deleteTarget?.version}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
