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

interface AddKeyboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: string[];
  onSave: (data: { source: string; version: string; text: string; content: string; useBase64: boolean }) => Promise<void>;
}

export default function AddKeyboxDialog({ open, onOpenChange, sources, onSave }: AddKeyboxDialogProps) {
  const [source, setSource] = useState('');
  const [version, setVersion] = useState('');
  const [text, setText] = useState('');
  const [content, setContent] = useState('');
  const [useBase64, setUseBase64] = useState(true);
  const [providerOpen, setProviderOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const nextVersion = sources.includes(source)
    ? String(sources.filter(s => s === source).length + 1 + Math.floor(Math.random() * 100))
    : '1';

  const handleSave = async () => {
    if (!source || !content) return;
    setSaving(true);
    await onSave({ source, version: version || nextVersion, text, content, useBase64 });
    setSaving(false);
    setSource('');
    setVersion('');
    setText('');
    setContent('');
    setUseBase64(true);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Keybox</DialogTitle>
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
                    <SelectValue placeholder="Select provider" />
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
                placeholder="Paste keybox XML content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
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
            <Button onClick={handleSave} disabled={!source || !content || saving}>{saving ? 'Saving...' : 'Save'}</Button>
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
