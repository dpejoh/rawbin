import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeleteDialogProps {
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteDialog({ open, name, onClose, onConfirm }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{name}&rdquo;?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This will permanently remove the clipboard and its raw endpoint. This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
