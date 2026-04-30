import { useState, useCallback } from 'react';
import { useMduiDialog, useMduiInput } from '../../hooks/useMdui';

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, slug?: string) => Promise<void>;
}

export default function CreateDialog({ open, onClose, onCreate }: CreateDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const dialogRef = useMduiDialog(open, onClose);
  const nameRef   = useMduiInput(name, setName);
  const slugRef   = useMduiInput(slug, setSlug);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed, slug.trim() || undefined);
    setName('');
    setSlug('');
    onClose();
  }, [name, slug, onCreate, onClose]);

  const handleClose = useCallback(() => {
    setName('');
    setSlug('');
    onClose();
  }, [onClose]);

  return (
    <mdui-dialog
      ref={dialogRef}
      headline="New Clipboard"
      close-on-overlay-click
      close-on-esc
    >
      <div className="field-group">
        <mdui-text-field
          ref={nameRef}
          variant="outlined"
          label="Name"
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleCreate(); }}
        />
        <mdui-text-field
          ref={slugRef}
          variant="outlined"
          label="Custom URL (optional)"
          placeholder="my-custom-link"
          helper="Alphanumeric, hyphens, underscores"
        />
      </div>

      <mdui-button slot="action" variant="text" onClick={handleClose}>
        Cancel
      </mdui-button>
      <mdui-button slot="action" variant="tonal" onClick={handleCreate}>
        Create
      </mdui-button>
    </mdui-dialog>
  );
}
