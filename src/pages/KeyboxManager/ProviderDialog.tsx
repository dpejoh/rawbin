import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
  title?: string;
}

export default function ProviderDialog({ open, onOpenChange, onConfirm, title = 'Add Provider' }: ProviderDialogProps) {
  const [value, setValue] = useState('');

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      setValue('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); setValue(''); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            placeholder="e.g. droidwin"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setValue(''); }}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!value.trim()}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
