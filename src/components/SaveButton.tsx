import { Loader2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SaveButtonProps {
  loading: boolean;
  hasUnsaved: boolean;
  onSave: () => void;
}

export default function SaveButton({ loading, hasUnsaved, onSave }: SaveButtonProps) {
  return (
    <div className="inline-flex items-center gap-2">
      {hasUnsaved && <Circle className="size-2 fill-primary text-primary" />}
      <Button
        size="lg"
        onClick={onSave}
        disabled={!hasUnsaved || loading}
      >
        {loading && <Loader2 className="size-4 animate-spin mr-1" />}
        Save
      </Button>
    </div>
  );
}
