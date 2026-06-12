import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import { useSnackbar } from 'notistack';

const R2_WORKER = import.meta.env.VITE_R2_WORKER_URL ?? "http://localhost:8787";

interface UploadDialogProps {
  open: boolean;
  token: string | null;
  currentFolderId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadDialog({ open, token, currentFolderId, onClose, onUploaded }: UploadDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [mode,        setMode]        = useState<'file' | 'url'>('file');
  const [url,         setUrl]         = useState('');
  const [fileName,    setFileName]    = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async () => {
    if (!token) return;
    if (mode === 'file') { fileInputRef.current?.click(); return; }
    setIsUploading(true);
    const name = fileName.trim() || `from-url-${Date.now()}`;
    const params = new URLSearchParams({ name, url, parentId: currentFolderId });
    const res = await fetch(`/.netlify/functions/files?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (data.error) {
      enqueueSnackbar(String(data.error), { variant: 'error' });
    } else {
      enqueueSnackbar('File uploaded from URL', { variant: 'success' });
      onUploaded();
    }
    setIsUploading(false);
  }, [token, mode, url, fileName, currentFolderId, onUploaded, enqueueSnackbar]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsUploading(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      const fileRes = await fetch(`${R2_WORKER}/upload/files?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        body: uploadForm,
      });
      if (!fileRes.ok) {
        const errText = await fileRes.text().catch(() => '');
        enqueueSnackbar(errText || 'Storage upload failed', { variant: 'error' });
        setIsUploading(false);
        return;
      }
      const { id: blobId, size } = await fileRes.json() as { id: string; size: number };

      const metaRes = await fetch('/.netlify/functions/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: file.name,
          blobId, size,
          mimeType: file.type || 'application/octet-stream',
          parentId: currentFolderId,
        }),
      });
      const metaData = await metaRes.json().catch(() => ({})) as Record<string, unknown>;
      if (metaData.error) {
        enqueueSnackbar(String(metaData.error), { variant: 'error' });
      } else {
        enqueueSnackbar('File uploaded', { variant: 'success' });
        onUploaded();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      enqueueSnackbar(msg || 'Upload failed', { variant: 'error' });
    }
    setIsUploading(false);
    e.target.value = '';
  }, [token, currentFolderId, onUploaded, enqueueSnackbar]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Upload File</DialogTitle>
      <DialogContent>
        <Box className="field-group">
          <Box className="mode-toggle">
            <Button
              variant={mode === 'file' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<UploadFileIcon />}
              onClick={() => setMode('file')}
              sx={{ textTransform: 'none' }}
            >
              From disk
            </Button>
            <Button
              variant={mode === 'url' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<InsertLinkIcon />}
              onClick={() => setMode('url')}
              sx={{ textTransform: 'none' }}
            >
              From URL
            </Button>
          </Box>

          {mode === 'url' ? (
            <>
              <TextField label="File URL" variant="outlined" fullWidth value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/file.pdf" sx={{ mt: 2 }} />
              <TextField label="File name (optional)" variant="outlined" fullWidth value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="my-file.pdf" />
            </>
          ) : (
            <Box className="upload-dropzone" onClick={() => fileInputRef.current?.click()} sx={{ mt: 2 }}>
              <CloudUploadIcon sx={{ fontSize: 40, color: 'outline.main' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Click to select a file</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">Cancel</Button>
        <Button onClick={handleUpload} variant="contained" disabled={isUploading || (mode === 'url' && !url.trim())}>
          {isUploading ? 'Uploading\u2026' : 'Upload'}
        </Button>
      </DialogActions>
      <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
    </Dialog>
  );
}
