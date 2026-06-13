import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { guessAppName } from '../utils/guessAppName';
import { parseModule } from '../utils/parseModule';
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
  return { packageName, appName: guessAppName(packageName), versionCode: '0', versionName: '' };
}

const DEFAULT_STATE: FormState = {
  file: null,
  detectedType: 'keybox',
  keybox: { source: '', version: '1', text: '', useBase64: true },
  module: { moduleId: '', name: '', version: '1.0', versionCode: '1', author: '', description: '' },
  apk: { packageName: '', appName: '', versionCode: '0', versionName: '' },
};

export default function GlobalFab({ token, role, onNavigate }: GlobalFabProps) {
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
    const moduleFields = guessModuleFields(file);

    if (detectedType === 'apk') {
      const { parseAPK } = await import('../utils/parseAPK');
      const parsed = await parseAPK(file);
      if (parsed) {
        apkFields.packageName = parsed.packageName;
        apkFields.appName = guessAppName(parsed.packageName);
        apkFields.versionCode = String(parsed.versionCode);
        apkFields.versionName = parsed.versionName;
      }
    } else if (detectedType === 'module') {
      const parsed = await parseModule(file);
      if (parsed) {
        moduleFields.moduleId = parsed.moduleId;
        moduleFields.name = parsed.name;
        moduleFields.version = parsed.version;
        moduleFields.versionCode = String(parsed.versionCode);
        moduleFields.author = parsed.author;
        moduleFields.description = parsed.description;
      }
    }

    setForm({
      file,
      detectedType,
      keybox: guessKeyboxFields(file),
      module: moduleFields,
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
          toast.error(await res.text().catch(() => 'Upload failed'));
          setUploading(false);
          return;
        }
      } else {
        const r2Worker = import.meta.env.VITE_R2_WORKER_URL ?? "http://localhost:8787";

        const bucket = form.detectedType === 'module' ? 'modules' : 'apks';
        const uploadKey = form.detectedType === 'module'
          ? `${form.module.moduleId.trim() || form.file.name.replace(/\.zip$/i, '').trim()}.zip`
          : `${form.apk.packageName.trim() || form.file.name.replace(/\.apks?$/i, '').trim()}.apk`;
        const uploadForm = new FormData();
        uploadForm.append('file', form.file!);
        const fileRes = await fetch(`${r2Worker}/upload/${bucket}?key=${encodeURIComponent(uploadKey)}&token=${encodeURIComponent(token!)}`, {
          method: 'POST',
          body: uploadForm,
        });
        if (!fileRes.ok) {
          const errText = await fileRes.text().catch(() => '');
          toast.error(errText || `Upload failed (HTTP ${fileRes.status})`);
          setUploading(false);
          return;
        }
        let blobId: string, size: number;
        try {
          const data = await fileRes.json() as { id: string; size: number };
          blobId = data.id;
          size = data.size;
        } catch {
          toast.error('Invalid response from storage server');
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
              appName: form.apk.appName.trim() || guessAppName(form.apk.packageName.trim() || form.file.name.replace(/\.apks?$/i, '').trim()),
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
          toast.error(body || 'Invalid JSON response from server');
          setUploading(false);
          return;
        }
        if (metaData.error) {
          toast.error(String(metaData.error));
          setUploading(false);
          return;
        }
        successMsg = form.detectedType === 'module'
          ? `Module "${(metadata as { moduleId: string }).moduleId}" uploaded`
          : `APK "${(metadata as { packageName: string }).packageName}" uploaded`;
      }

      toast.success(successMsg);
      handleClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || 'Upload failed');
    }
    setUploading(false);
  }, [token, form, handleClose]);

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
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,.zip,.apk,.apks"
        className="hidden"
        onChange={handleFileSelect}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="fixed bottom-24 right-6 z-50 sm:bottom-6 flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        title="Upload file (Ctrl+Shift+U)"
      >
        <Plus className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudUpload className="size-5" />
              Upload
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {form.file && (
              <p className="text-sm text-muted-foreground font-mono">
                {form.file.name} ({(form.file.size / 1024).toFixed(1)} KB)
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.detectedType}
                onValueChange={(v) => setForm(prev => ({ ...prev, detectedType: v as DetectedType }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keybox">Keybox (XML)</SelectItem>
                  <SelectItem value="module">Module (ZIP)</SelectItem>
                  <SelectItem value="apk">APK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.detectedType === 'keybox' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <Input
                    value={form.keybox.source}
                    onChange={(e) => setField('source', e.target.value)}
                    placeholder="e.g. droidwin"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Version</Label>
                  <Input
                    value={form.keybox.version}
                    onChange={(e) => setField('version', e.target.value)}
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Label (optional)</Label>
                  <Input
                    value={form.keybox.text}
                    onChange={(e) => setField('text', e.target.value)}
                    placeholder="Display text"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.keybox.useBase64}
                    onCheckedChange={(v) => setField('useBase64', v)}
                  />
                  <Label>Base64</Label>
                </div>
              </div>
            )}

            {form.detectedType === 'module' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Module ID</Label>
                  <Input
                    value={form.module.moduleId}
                    onChange={(e) => setField('moduleId', e.target.value)}
                    placeholder="e.g. zygisk_lsposed"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={form.module.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Display name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Version</Label>
                  <Input
                    value={form.module.version}
                    onChange={(e) => setField('version', e.target.value)}
                    placeholder="e.g. 1.9.2"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Version Code</Label>
                  <Input
                    type="number"
                    value={form.module.versionCode}
                    onChange={(e) => setField('versionCode', e.target.value)}
                    placeholder="e.g. 19002"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Author (optional)</Label>
                  <Input
                    value={form.module.author}
                    onChange={(e) => setField('author', e.target.value)}
                    placeholder="Author name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={form.module.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Short description"
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            )}

            {form.detectedType === 'apk' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Package Name</Label>
                  <Input
                    value={form.apk.packageName}
                    onChange={(e) => setField('packageName', e.target.value)}
                    placeholder="e.g. com.example.app"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>App Name (optional)</Label>
                  <Input
                    value={form.apk.appName}
                    onChange={(e) => setField('appName', e.target.value)}
                    placeholder="Display name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Version Name (optional)</Label>
                  <Input
                    value={form.apk.versionName}
                    onChange={(e) => setField('versionName', e.target.value)}
                    placeholder="e.g. 2.1.0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Version Code</Label>
                  <Input
                    type="number"
                    value={form.apk.versionCode}
                    onChange={(e) => setField('versionCode', e.target.value)}
                    placeholder="e.g. 210"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !form.file}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
