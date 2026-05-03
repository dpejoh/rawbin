import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';

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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New Folder</DialogTitle>
      <DialogContent>
        <TextField
          label="Folder name"
          variant="outlined"
          fullWidth
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handle(); }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">Cancel</Button>
        <Button onClick={handle} variant="contained" disabled={!name.trim()}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}
