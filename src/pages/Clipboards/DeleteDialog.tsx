import { useMduiDialog } from '../../hooks/useMdui';

interface DeleteDialogProps {
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteDialog({ open, name, onClose, onConfirm }: DeleteDialogProps) {
  const dialogRef = useMduiDialog(open, onClose);

  return (
    <mdui-dialog
      ref={dialogRef}
      headline={`Delete "${name}"?`}
      icon="delete_forever"
      close-on-overlay-click
      close-on-esc
    >
      <p
        className="mdui-typescale-body-medium"
        style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
      >
        This will permanently remove the clipboard and its raw endpoint. This cannot be undone.
      </p>

      <mdui-button slot="action" variant="text" onClick={onClose}>
        Cancel
      </mdui-button>
      <mdui-button
        slot="action"
        variant="tonal"
        onClick={onConfirm}
        style={{ color: 'var(--mdui-color-error)' }}
      >
        Delete
      </mdui-button>
    </mdui-dialog>
  );
}
