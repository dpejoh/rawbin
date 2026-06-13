import { useState, useCallback, useMemo } from 'react';
import { FileText, MoreHorizontal, Link, Trash2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { relativeTime } from '../../utils/time';
import { detectContentType } from '../../utils/detectType';
import { decodeContent } from '../../utils/decodeContent';
import type { ClipboardItem } from '../../hooks/useClipboards';

interface ClipboardListProps {
  clipboards: ClipboardItem[];
  selectedId: string | null;
  isLoading: boolean;
  role: string;
  onSelect: (id: string) => void;
  onCopyUrl: (id: string) => void;
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
}

const typeChipVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  json: 'default',
  xml: 'secondary',
};

export default function ClipboardList({
  clipboards, selectedId, isLoading, role,
  onSelect, onCopyUrl, onDelete, onBatchDelete,
}: ClipboardListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const typeInfo: Record<string, { type: string; label: string }> = {};
  for (const cb of clipboards) {
    const decoded = decodeContent(cb.content ?? '', cb.useBase64 !== false);
    const info = detectContentType(decoded);
    typeInfo[cb.id] = info;
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return clipboards;
    const q = searchQuery.trim().toLowerCase();
    return clipboards.filter(cb =>
      cb.name.toLowerCase().includes(q) ||
      (cb.content ?? '').toLowerCase().includes(q)
    );
  }, [clipboards, searchQuery]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size > 0 && onBatchDelete) {
      onBatchDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [selectedIds, onBatchDelete]);

  const allVisibleSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const handleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  }, [filtered, allVisibleSelected]);

  if (isLoading) {
    return (
      <div className="w-72 min-w-72 border-r h-full overflow-y-auto shrink-0 p-2 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-72 min-w-72 border-r h-full overflow-y-auto shrink-0 flex flex-col">
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 pl-8 pr-7 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b">
        {selectMode && (
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={handleSelectAll}
            aria-label={allVisibleSelected ? 'Deselect all' : 'Select all'}
          />
        )}
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
          <>
            <Button variant="ghost" size="sm" className="text-xs h-6 px-1.5"
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
              Cancel
            </Button>
            {role === 'admin' && selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" className="text-xs h-6 px-1.5"
                onClick={handleBatchDelete}>
                <Trash2 className="size-3 mr-1" />
                {selectedIds.size}
              </Button>
            )}
          </>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.map((cb) => {
          const isActive = cb.id === selectedId;
          const isSelected = selectedIds.has(cb.id);
          const info = typeInfo[cb.id];
          return (
            <div
              key={cb.id}
              onClick={() => { if (!isSelected) onSelect(cb.id); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors border ${
                isActive ? 'bg-primary/10 border-primary/30' : isSelected ? 'bg-primary/10 border-primary/30' : 'bg-card hover:bg-accent border-border'
              }`}
            >
              <div className="size-9 shrink-0 flex items-center justify-center">
                {selectMode ? (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleSelect(cb.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <FileText className="size-6 text-primary" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {cb.name}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                  <span>{relativeTime(cb.updatedAt)}</span>
                  <span>·</span>
                  <span>{cb.content.length.toLocaleString()} chars</span>
                  {(info?.type === 'json' || info?.type === 'xml') && (
                    <Badge variant={typeChipVariant[info.type] ?? 'outline'} className="text-[10px] px-1 py-0 h-4 shrink-0">
                      {info.label}
                    </Badge>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopyUrl(cb.id); }}>
                    <Link className="size-4 mr-2" />
                    Copy raw URL
                  </DropdownMenuItem>
                  {role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(cb.id); }} className="text-destructive">
                        <Trash2 className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        {filtered.length === 0 && searchQuery && (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            No clipboards match "{searchQuery}"
          </p>
        )}
      </div>
    </div>
  );
}
