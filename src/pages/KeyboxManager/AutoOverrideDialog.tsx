import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface AutoOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: string[];
  overrideSource: string;
  overrideVersion: string;
  onOverrideSourceChange: (v: string) => void;
  onOverrideVersionChange: (v: string) => void;
  onSave: () => Promise<void>;
  onClear: () => Promise<void>;
  hasExisting: boolean;
}

export default function AutoOverrideDialog({
  open, onOpenChange, sources,
  overrideSource, overrideVersion,
  onOverrideSourceChange, onOverrideVersionChange,
  onSave, onClear, hasExisting,
}: AutoOverrideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Auto Override</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Override the automatic working selection. Leave version empty to always use the latest.
        </p>
        <div className="space-y-3">
          <Select value={overrideSource || '__placeholder'} onValueChange={onOverrideSourceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Version (optional)"
            value={overrideVersion}
            onChange={(e) => onOverrideVersionChange(e.target.value)}
          />
        </div>
        <DialogFooter>
          {hasExisting && (
            <Button variant="destructive" className="mr-auto" onClick={onClear}>
              Clear override
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={!overrideSource}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
