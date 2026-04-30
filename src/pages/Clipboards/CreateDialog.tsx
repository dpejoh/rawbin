import { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
} from "@mui/material";

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, slug?: string) => Promise<void>;
}

export default function CreateDialog({ open, onClose, onCreate }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed, slug.trim() || undefined);
    setName("");
    setSlug("");
    onClose();
  }, [name, slug, onCreate, onClose]);

  const handleClose = useCallback(() => {
    setName("");
    setSlug("");
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>New Clipboard</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            variant="outlined"
            fullWidth
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <TextField
            label="Custom URL (optional)"
            variant="outlined"
            fullWidth
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-custom-link"
            helperText="Alphanumeric, hyphens, underscores"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="text">
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={!name.trim()}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
