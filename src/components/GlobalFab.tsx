import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Fab, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Typography, Switch, Box, Select, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useSnackbar } from 'notistack';
import type { Page } from '../App';
import type { UserRole } from '../hooks/useAuth';

type DetectedType = 'keybox' | 'module' | 'apk';

interface KeyboxFields {
  source: string;
  version: string;
  text: string;
  useBase64: boolean;
}

interface ModuleFields {
  moduleId: string;
  name: string;
  version: string;
  versionCode: string;
  author: string;
  description: string;
}

interface ApkFields {
  packageName: string;
  appName: string;
  versionCode: string;
  versionName: string;
}

type FormState = {
  file: File | null;
  detectedType: DetectedType;
  keybox: KeyboxFields;
  module: ModuleFields;
  apk: ApkFields;
};

interface GlobalFabProps {
  token: string | null;
  role: string;
  onNavigate: (page: Page) => void;
}

function detectFileType(file: File): DetectedType {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xml')) return 'keybox';
  if (name.endsWith('.apk') || name.endsWith('.apks')) return 'apk';
  if (name.endsWith('.zip')) return 'module';
  return 'keybox';
}

function guessKeyboxFields(file: File): KeyboxFields {
  const name = file.name.replace(/\.xml$/i, '');
  const parts = name.split(/[-_]/);
  const source = parts[0] ?? name;
  const version = parts[1] ?? '1';
  return { source, version, text: '', useBase64: true };
}

function guessModuleFields(file: File): ModuleFields {
  const name = file.name.replace(/\.zip$/i, '');
  const parts = name.split(/[-_]/);
  const moduleId = parts[0] ?? name;
  return { moduleId, name: moduleId, version: '1.0', versionCode: '1', author: '', description: '' };
}

function guessApkFields(file: File): ApkFields {
  const name = file.name.replace(/\.apks?$/i, '');
  const parts = name.split(/[-_]/);
  const packageName = parts[0] ?? name;
  return { packageName, appName: packageName, versionCode: '0', versionName: '' };
}

const DEFAULT_STATE: FormState = {
  file: null,
  detectedType: 'keybox',
  keybox: { source: '', version: '1', text: '', useBase64: true },
  module: { moduleId: '', name: '', version: '1.0', versionCode: '1', author: '', description: '' },
  apk: { packageName: '', appName: '', versionCode: '0', versionName: '' },
};

export default function GlobalFab({ token, role, onNavigate }: GlobalFabProps) {
  const { enqueueSnackbar } = useSnackbar();
  if (role === 'viewer') return null;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        if (token) fileInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [token]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const detectedType = detectFileType(file);
    const apkFields = guessApkFields(file);

    if (detectedType === 'apk') {
      const { parseAPK } = await import('../utils/parseAPK');
      const parsed = await parseAPK(file);
      if (parsed) {
        apkFields.packageName = parsed.packageName;
        apkFields.appName = parsed.label || parsed.packageName;
        apkFields.versionCode = String(parsed.versionCode);
        apkFields.versionName = parsed.versionName;
      }
    }

    setForm({
      file,
      detectedType,
      keybox: guessKeyboxFields(file),
      module: guessModuleFields(file),
      apk: apkFields,
    });
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setForm(DEFAULT_STATE);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!token || !form.file) return;

    setUploading(true);
    try {
      let successMsg = '';

      if (form.detectedType === 'keybox') {
        const body = {
          source: form.keybox.source.trim() || 'uploaded',
          version: form.keybox.version.trim() || '1',
          text: form.keybox.text || form.keybox.version,
          content: form.file ? await form.file.text() : '',
          useBase64: form.keybox.useBase64,
        };
        const res = await fetch('/.netlify/functions/catalog/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          successMsg = `Keybox "${body.source} v${body.version}" saved`;
        } else {
          enqueueSnackbar(await res.text().catch(() => 'Upload failed'), { variant: 'error' });
          setUploading(false);
          return;
        }
      } else {
        const r2Worker = import.meta.env.VITE_R2_WORKER_URL ?? "http://localhost:8787";

        const bucket = form.detectedType === 'module' ? 'modules' : 'apks';
        const uploadKey = form.detectedType === 'module'
          ? `${form.module.moduleId.trim() || form.file.name.replace(/\.zip$/i, '').trim()}.zip`
          : `${form.apk.packageName.trim() || form.file.name.replace(/\.apks?$/i, '').trim()}.apk`;
        const fileRes = await fetch(`${r2Worker}/upload/${bucket}?key=${encodeURIComponent(uploadKey)}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: form.file,
        });
        if (!fileRes.ok) {
          const errText = await fileRes.text().catch(() => '');
          enqueueSnackbar(errText || `Upload failed (HTTP ${fileRes.status})`, { variant: 'error' });
          setUploading(false);
          return;
        }
        let blobId: string, size: number;
        try {
          const data = await fileRes.json() as { id: string; size: number };
          blobId = data.id;
          size = data.size;
        } catch {
          enqueueSnackbar('Invalid response from storage server', { variant: 'error' });
          setUploading(false);
          return;
        }

        const endpoint = form.detectedType === 'module' ? '/.netlify/functions/modules' : '/.netlify/functions/apks';
        const metadata = form.detectedType === 'module'
          ? {
              blobId, size,
              moduleId: form.module.moduleId.trim() || form.file.name.replace(/\.zip$/i, '').trim(),
              name: form.module.name.trim() || form.file.name.replace(/\.zip$/i, '').trim(),
              version: form.module.version.trim() || '1.0',
              versionCode: parseInt(form.module.versionCode, 10) || 1,
              author: form.module.author.trim(),
              description: form.module.description.trim(),
            }
          : {
              blobId, size,
              packageName: form.apk.packageName.trim() || form.file.name.replace(/\.apks?$/i, '').trim(),
              appName: form.apk.appName.trim() || form.file.name.replace(/\.apks?$/i, '').trim(),
              versionCode: parseInt(form.apk.versionCode, 10) || 0,
              versionName: form.apk.versionName.trim(),
            };

        const metaRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(metadata),
        });
        let metaData: Record<string, unknown>;
        try {
          metaData = await metaRes.json() as Record<string, unknown>;
        } catch {
          const body = await metaRes.text().catch(() => '');
          enqueueSnackbar(body || 'Invalid JSON response from server', { variant: 'error' });
          setUploading(false);
          return;
        }
        if (metaData.error) {
          enqueueSnackbar(String(metaData.error), { variant: 'error' });
          setUploading(false);
          return;
        }
        successMsg = form.detectedType === 'module'
          ? `Module "${(metadata as { moduleId: string }).moduleId}" uploaded`
          : `APK "${(metadata as { packageName: string }).packageName}" uploaded`;
      }

      enqueueSnackbar(successMsg, { variant: 'success' });
      handleClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      enqueueSnackbar(msg || 'Upload failed', { variant: 'error' });
    }
    setUploading(false);
  }, [token, form, enqueueSnackbar, handleClose]);

  const setField = useCallback(<T,>(field: string, value: T) => {
    setForm(prev => {
      if (prev.detectedType === 'keybox') return { ...prev, keybox: { ...prev.keybox, [field]: value } };
      if (prev.detectedType === 'module') return { ...prev, module: { ...prev.module, [field]: value } };
      return { ...prev, apk: { ...prev.apk, [field]: value } };
    });
  }, []);

  const pageForType: Record<DetectedType, Page> = { keybox: 'keybox', module: 'modules', apk: 'apks' };

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".xml,.zip,.apk,.apks" style={{ display: 'none' }} onChange={handleFileSelect} />
      <Fab
        color="primary"
        onClick={() => fileInputRef.current?.click()}
        sx={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 1100,
          borderRadius: 2,
        }}
        title="Upload file (Ctrl+Shift+U)"
      >
        <AddIcon />
      </Fab>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CloudUploadIcon />
            <Typography>Upload</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {form.file && (
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: '"Geist Mono", monospace' }}>
                {form.file.name} ({(form.file.size / 1024).toFixed(1)} KB)
              </Typography>
            )}

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Type
              </Typography>
              <Select
                value={form.detectedType}
                onChange={(e) => setForm(prev => ({ ...prev, detectedType: e.target.value as DetectedType }))}
                size="small" fullWidth
              >
                <MenuItem value="keybox">Keybox (XML)</MenuItem>
                <MenuItem value="module">Module (ZIP)</MenuItem>
                <MenuItem value="apk">APK</MenuItem>
              </Select>
            </Box>

            {form.detectedType === 'keybox' && (
              <>
                <TextField label="Source" size="small" fullWidth
                  value={form.keybox.source}
                  onChange={(e) => setForm(prev => ({ ...prev, keybox: { ...prev.keybox, source: e.target.value } }))}
                  placeholder="e.g. droidwin"
                />
                <TextField label="Version" size="small" fullWidth
                  value={form.keybox.version}
                  onChange={(e) => setForm(prev => ({ ...prev, keybox: { ...prev.keybox, version: e.target.value } }))}
                  placeholder="e.g. 3"
                />
                <TextField label="Label (optional)" size="small" fullWidth
                  value={form.keybox.text}
                  onChange={(e) => setForm(prev => ({ ...prev, keybox: { ...prev.keybox, text: e.target.value } }))}
                  placeholder="Display text"
                />
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Switch
                    checked={form.keybox.useBase64}
                    onChange={(e) => setForm(prev => ({ ...prev, keybox: { ...prev.keybox, useBase64: e.target.checked } }))}
                    size="small"
                  />
                  <Typography variant="body2" color="text.secondary">Base64</Typography>
                </Stack>
              </>
            )}

            {form.detectedType === 'module' && (
              <>
                <TextField label="Module ID" size="small" fullWidth
                  value={form.module.moduleId}
                  onChange={(e) => setForm(prev => ({ ...prev, module: { ...prev.module, moduleId: e.target.value } }))}
                  placeholder="e.g. zygisk_lsposed"
                />
                <TextField label="Name" size="small" fullWidth
                  value={form.module.name}
                  onChange={(e) => setForm(prev => ({ ...prev, module: { ...prev.module, name: e.target.value } }))}
                  placeholder="Display name"
                />
                <TextField label="Version" size="small" fullWidth
                  value={form.module.version}
                  onChange={(e) => setForm(prev => ({ ...prev, module: { ...prev.module, version: e.target.value } }))}
                  placeholder="e.g. 1.9.2"
                />
                <TextField label="Version Code" size="small" fullWidth type="number"
                  value={form.module.versionCode}
                  onChange={(e) => setForm(prev => ({ ...prev, module: { ...prev.module, versionCode: e.target.value } }))}
                  placeholder="e.g. 19002"
                />
                <TextField label="Author (optional)" size="small" fullWidth
                  value={form.module.author}
                  onChange={(e) => setForm(prev => ({ ...prev, module: { ...prev.module, author: e.target.value } }))}
                  placeholder="Author name"
                />
                <TextField label="Description (optional)" size="small" fullWidth multiline maxRows={3}
                  value={form.module.description}
                  onChange={(e) => setForm(prev => ({ ...prev, module: { ...prev.module, description: e.target.value } }))}
                  placeholder="Short description"
                />
              </>
            )}

            {form.detectedType === 'apk' && (
              <>
                <TextField label="Package Name" size="small" fullWidth
                  value={form.apk.packageName}
                  onChange={(e) => setForm(prev => ({ ...prev, apk: { ...prev.apk, packageName: e.target.value } }))}
                  placeholder="e.g. com.example.app"
                />
                <TextField label="App Name (optional)" size="small" fullWidth
                  value={form.apk.appName}
                  onChange={(e) => setForm(prev => ({ ...prev, apk: { ...prev.apk, appName: e.target.value } }))}
                  placeholder="Display name"
                />
                <TextField label="Version Name (optional)" size="small" fullWidth
                  value={form.apk.versionName}
                  onChange={(e) => setForm(prev => ({ ...prev, apk: { ...prev.apk, versionName: e.target.value } }))}
                  placeholder="e.g. 2.1.0"
                />
                <TextField label="Version Code" size="small" fullWidth type="number"
                  value={form.apk.versionCode}
                  onChange={(e) => setForm(prev => ({ ...prev, apk: { ...prev.apk, versionCode: e.target.value } }))}
                  placeholder="e.g. 210"
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload} disabled={uploading || !form.file}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
