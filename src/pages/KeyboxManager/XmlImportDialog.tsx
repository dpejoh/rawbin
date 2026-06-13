import { useState } from 'react';
import { Input } from '@/components/ui/input';
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

interface XmlItem {
  filename: string;
  content: string;
  version: string;
  text: string;
  source: string;
}

interface XmlImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: XmlItem[];
  onUpdateItem: (index: number, item: XmlItem) => void;
  sources: string[];
  onImport: () => Promise<void>;
  isImporting: boolean;
}

export default function XmlImportDialog({ open, onOpenChange, items, onUpdateItem, sources, onImport, isImporting }: XmlImportDialogProps) {
  const [providerIndex, setProviderIndex] = useState<number | null>(null);
  const [newProvider, setNewProvider] = useState('');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import XML Keyboxes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-80 overflow-auto">
            {items.map((item, i) => (
              <div key={i} className="p-4 border border-border rounded-lg">
                <p className="text-sm font-medium mb-2">{item.filename}</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Provider</Label>
                    <Select value={item.source || '__placeholder'} onValueChange={(v) => {
                      if (v === '__add__') { setProviderIndex(i); }
                      else onUpdateItem(i, { ...item, source: v });
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
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input value={item.text} onChange={(e) => onUpdateItem(i, { ...item, text: e.target.value })} placeholder="Display label" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onImport} disabled={isImporting || items.some(i => !i.source)}>
              {isImporting ? 'Importing...' : `Import ${items.length} file${items.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ProviderDialog
        open={providerIndex !== null}
        onOpenChange={() => setProviderIndex(null)}
        onConfirm={(name) => {
          if (providerIndex !== null) {
            onUpdateItem(providerIndex, { ...items[providerIndex]!, source: name });
            setProviderIndex(null);
          }
        }}
      />
    </>
  );
}
