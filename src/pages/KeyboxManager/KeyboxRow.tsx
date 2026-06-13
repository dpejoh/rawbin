import { useState, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, Pencil, Trash2, RefreshCw,
  ShieldCheck, ShieldOff, AlertTriangle, Loader2, Fingerprint,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import RawUrlRow from '../../components/RawUrlRow';
import { relativeTime } from '../../utils/time';
import EditKeyboxDialog from './EditKeyboxDialog';
import type { HistoryEntry, StatusType } from './types';

interface KeyboxRowProps {
  entry: HistoryEntry;
  isSelected: boolean;
  selectMode: boolean;
  content: string | null;
  isLoadingContent: boolean;
  expanded: boolean;
  role: string;
  token: string | null;
  sources: string[];
  onToggleSelect: (entry: HistoryEntry) => void;
  onExpand: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onRecheck: (entry: HistoryEntry) => void;
  onSetStatus: (entry: HistoryEntry, status: StatusType) => void;
  onEditSave: (entry: HistoryEntry, data: { source: string; version: string; text: string; content: string; useBase64: boolean }) => Promise<void>;
  isSettingStatus: boolean;
  isRechecking: boolean;
}

export default function KeyboxRow({
  entry, isSelected, selectMode, content, isLoadingContent,
  expanded, role, token, sources,
  onToggleSelect, onExpand, onDelete, onRecheck, onSetStatus,
  onEditSave, isSettingStatus, isRechecking,
}: KeyboxRowProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const statusText = entry.revoked ? 'Revoked' : entry.softbanned ? 'Softbanned' : 'Active';
  const statusVariant = entry.revoked ? 'destructive' as const : entry.softbanned ? 'warning' as const : 'success' as const;
  const StatusIcon = entry.revoked ? ShieldOff : entry.softbanned ? AlertTriangle : ShieldCheck;

  const handleExpand = useCallback(() => {
    if (!editDialogOpen) onExpand(entry);
  }, [entry, onExpand, editDialogOpen]);

  return (
    <>
      <div>
        <div
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button, [role="combobox"]')) return;
            handleExpand();
          }}
          className={`flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${
            expanded ? 'rounded-t-lg border border-border border-b-0' : 'rounded-lg border border-border'
          } ${isSelected ? 'bg-primary/10' : 'bg-card'} hover:bg-accent`}
        >
          <div className="size-9 flex-shrink-0 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); if (selectMode) onToggleSelect(entry); }}>
            {selectMode ? (
              <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(entry)} />
            ) : null}
          </div>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-center min-w-[80px]">
              <p className="text-xs text-muted-foreground leading-none">{entry.source}</p>
              <p className="text-base font-semibold">{entry.text || entry.version}</p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Fingerprint className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono truncate">{entry.serial}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(entry.timestamp)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={statusVariant} className="gap-1 text-[11px]">
              <StatusIcon className="size-3" />
              {statusText}
            </Badge>
            {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <div className="px-4 py-3 rounded-b-lg border border-border border-t-0 bg-card space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['Label', entry.text || entry.version],
                ['Source', entry.source],
                ['Version', entry.version],
                ['Serial', entry.serial],
                ['Date', new Date(entry.timestamp).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 w-12">{label}</span>
                  <span className="text-xs font-mono break-all">{value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge variant={statusVariant} className="gap-1 text-[11px]">
                  <StatusIcon className="size-3" />
                  {statusText}
                </Badge>
              </div>
            </div>

            <RawUrlRow url={`${window.location.origin}/key/${entry.source}/${entry.version}`} />

            {isLoadingContent ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : content && (
              <Textarea value={content} readOnly spellCheck={false}
                className="min-h-[80px] max-h-[240px] font-mono text-xs" />
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {role === 'admin' && (
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditDialogOpen(true); }}>
                  <Pencil className="size-3.5 mr-1" />
                  Edit
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onRecheck(entry); }} disabled={isRechecking}>
                <RefreshCw className={`size-3.5 mr-1 ${isRechecking ? 'animate-spin' : ''}`} />
                {isRechecking ? 'Checking...' : 'Re-check'}
              </Button>
              <Select
                value={entry.revoked ? 'revoked' : entry.softbanned ? 'softbanned' : 'active'}
                onValueChange={(val) => onSetStatus(entry, val as StatusType)}
                disabled={isSettingStatus}
              >
                <SelectTrigger size="sm" className="w-[130px] text-xs" aria-label="Set status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <ShieldCheck className="size-4 text-green-500 inline mr-1" />
                    Active
                  </SelectItem>
                  <SelectItem value="softbanned">
                    <AlertTriangle className="size-4 text-yellow-500 inline mr-1" />
                    Softbanned
                  </SelectItem>
                  <SelectItem value="revoked">
                    <ShieldOff className="size-4 text-red-500 inline mr-1" />
                    Revoked
                  </SelectItem>
                </SelectContent>
              </Select>
              {role === 'admin' && (
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(entry); }}>
                  <Trash2 className="size-3.5 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <EditKeyboxDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        entry={entry}
        content={content ?? ''}
        sources={sources}
        onSave={(data) => onEditSave(entry, data)}
      />
    </>
  );
}
