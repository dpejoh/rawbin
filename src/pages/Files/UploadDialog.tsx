import { useState, useCallback, useRef } from 'react';
import { Upload, Link } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface UploadDialogProps {
  open: boolean;
  token: string | null;
  currentFolderId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadDialog({ open, token, currentFolderId, onClose, onUploaded }: UploadDialogProps) {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async () => {
    if (!token) return;
    if (mode === 'file') { fileInputRef.current?.click(); return; }
    setIsUploading(true);
    const name = fileName.trim() || `from-url-${Date.now()}`;
    const params = new URLSearchParams({ name, url, parentId: currentFolderId });
    const res = await fetch(`/api/files?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (data.error) {
      toast.error(String(data.error));
    } else {
      toast.success('File uploaded from URL');
      onUploaded();
    }
    setIsUploading(false);
  }, [token, mode, url, fileName, currentFolderId, onUploaded]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsUploading(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      const fileRes = await fetch(`/upload/files?key=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: uploadForm,
      });
      if (!fileRes.ok) {
        const errText = await fileRes.text().catch(() => '');
        toast.error(errText || 'Storage upload failed');
        setIsUploading(false);
        return;
      }
      const { id: blobId, size } = await fileRes.json() as { id: string; size: number };

      const metaRes = await fetch('/api/files', {
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
        toast.error(String(metaData.error));
      } else {
        toast.success('File uploaded');
        onUploaded();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || 'Upload failed');
    }
    setIsUploading(false);
    e.target.value = '';
  }, [token, currentFolderId, onUploaded]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              variant={mode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('file')}
            >
              <Upload className="size-4 mr-1" />
              From disk
            </Button>
            <Button
              variant={mode === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('url')}
            >
              <Link className="size-4 mr-1" />
              From URL
            </Button>
          </div>

          {mode === 'url' ? (
            <div className="space-y-3">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/file.pdf"
              />
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="File name (optional)"
              />
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-muted-foreground rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:bg-accent transition-colors"
            >
              <Upload className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to select a file</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleUpload} disabled={isUploading || (mode === 'url' && !url.trim())}>
            {isUploading ? 'Uploading\u2026' : 'Upload'}
          </Button>
        </DialogFooter>
        <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
      </DialogContent>
    </Dialog>
  );
}
