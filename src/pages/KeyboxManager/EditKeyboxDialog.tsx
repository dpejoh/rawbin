import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ProviderDialog from './ProviderDialog';
import type { HistoryEntry } from './types';

interface EditKeyboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: HistoryEntry;
  content: string;
  sources: string[];
  onSave: (data: { source: string; version: string; text: string; content: string; useBase64: boolean }) => Promise<void>;
}

export default function EditKeyboxDialog({ open, onOpenChange, entry, content, sources, onSave }: EditKeyboxDialogProps) {
  const [source, setSource] = useState(entry.source);
  const [text, setText] = useState(entry.text || '');
  const [editContent, setEditContent] = useState(content);
  const [useBase64, setUseBase64] = useState(true);
  const [providerOpen, setProviderOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!source || !editContent) return;
    setSaving(true);
    await onSave({ source, version: entry.version, text, content: editContent, useBase64 });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {entry.source} v{entry.version}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-3 items-start">
              <div className="flex-1 space-y-1.5">
                <Label>Provider</Label>
                <Select value={source || '__placeholder'} onValueChange={(v) => {
                  if (v === '__add__') setProviderOpen(true);
                  else setSource(v);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    <SelectSeparator />
                    <SelectItem value="__add__">✚ Add provider</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Label</Label>
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Display label" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>XML Content</Label>
              <Textarea
                className="min-h-[160px] font-mono text-sm"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={useBase64} onCheckedChange={setUseBase64} />
              <Label className="text-sm text-muted-foreground">Base64</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!source || !editContent || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ProviderDialog
        open={providerOpen}
        onOpenChange={setProviderOpen}
        onConfirm={(name) => { setSource(name); setProviderOpen(false); }}
      />
    </>
  );
}
