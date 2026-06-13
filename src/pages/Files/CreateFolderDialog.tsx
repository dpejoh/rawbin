import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export default function CreateFolderDialog({ open, onClose, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState('');

  const handle = useCallback(() => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
    onClose();
  }, [name, onCreate, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setName(''); } }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => { if (e.key === 'Enter') handle(); }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={!name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
