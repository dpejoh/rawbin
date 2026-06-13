import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, slug?: string, useShuffle?: boolean) => Promise<void>;
}

export default function CreateDialog({ open, onClose, onCreate }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [useShuffle, setUseShuffle] = useState(false);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed, slug.trim() || undefined, useShuffle);
    setName("");
    setSlug("");
    setUseShuffle(false);
    onClose();
  }, [name, slug, useShuffle, onCreate, onClose]);

  const handleClose = useCallback(() => {
    setName("");
    setSlug("");
    setUseShuffle(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>New Clipboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Clipboard name"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Custom URL (optional)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-custom-link"
            />
            <p className="text-xs text-muted-foreground">Alphanumeric, hyphens, underscores</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={useShuffle}
              onCheckedChange={setUseShuffle}
            />
            <Label className="text-sm text-muted-foreground">randomization</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
