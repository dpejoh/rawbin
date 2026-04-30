import { useEffect, useState, useCallback, useRef } from "react";
import {
  Stack,
  Typography,
  Button,
  IconButton,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Chip,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertLinkIcon from "@mui/icons-material/InsertLink";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionIcon from "@mui/icons-material/Description";
import ImageIcon from "@mui/icons-material/Image";
import ArchiveIcon from "@mui/icons-material/Archive";
import DataObjectIcon from "@mui/icons-material/DataObject";
import { useSnackbar } from "notistack";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon />;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("rar") || mimeType.includes("7z")) return <ArchiveIcon />;
  if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("yaml")) return <DataObjectIcon />;
  return <DescriptionIcon />;
}

function fileUrl(id: string): string {
  return `${window.location.origin}/file/${id}`;
}

interface FilesPageProps {
  token: string | null;
}

export default function FilesPage({ token }: FilesPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/.netlify/functions/files", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as FileItem[];
        setFiles(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleCopyUrl = useCallback(async (id: string) => {
    const url = fileUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      enqueueSnackbar("File URL copied", { variant: "info" });
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      enqueueSnackbar("Failed to copy", { variant: "error" });
    }
  }, [enqueueSnackbar]);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteTarget) return;
    const res = await fetch("/.netlify/functions/files", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: deleteTarget.id }),
    });
    if (res.ok) {
      enqueueSnackbar("File deleted", { variant: "success" });
      fetchFiles();
    } else {
      enqueueSnackbar("Failed to delete", { variant: "error" });
    }
    setDeleteTarget(null);
  }, [token, deleteTarget, enqueueSnackbar, fetchFiles]);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <Stack spacing={3} sx={{ p: 4, maxWidth: 800 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Stack>
          <Typography variant="h4" sx={{ color: "text.primary" }}>
            Files
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Host files with raw access endpoints.
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadOpen(true)}
          sx={{ textTransform: "none" }}
        >
          Upload
        </Button>
      </Stack>

      {files.length > 0 && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {files.length} file{files.length !== 1 ? "s" : ""} · {formatSize(totalSize)} total
        </Typography>
      )}

      {isLoading ? (
        <Stack spacing={1}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : files.length === 0 ? (
        <Stack alignItems="center" justifyContent="center" sx={{ gap: 2, py: 8 }}>
          <CloudUploadIcon sx={{ fontSize: 64, color: "outline.main" }} />
          <Typography variant="h5" sx={{ color: "text.primary" }}>
            No files yet
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
            Upload a file or fetch from a URL.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setUploadOpen(true)}
            sx={{ textTransform: "none" }}
          >
            Upload your first file
          </Button>
        </Stack>
      ) : (
        <Stack spacing={0.5}>
          {files.map((file) => (
            <Stack
              key={file.id}
              direction="row"
              alignItems="center"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: "surfaceContainer.main",
                "&:hover": { bgcolor: "surfaceContainerHigh.main" },
                gap: 1.5,
              }}
            >
              <Stack sx={{ color: "text.secondary", fontSize: 20 }}>
                {fileIcon(file.mimeType)}
              </Stack>

              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ color: "text.primary", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {file.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {formatSize(file.size)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "outline.main" }}>·</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {relativeTime(file.createdAt)}
                  </Typography>
                </Stack>
              </Stack>

              <Tooltip title="Copy raw URL">
                <IconButton
                  size="small"
                  onClick={() => handleCopyUrl(file.id)}
                  sx={{ color: "text.secondary" }}
                >
                  {copiedId === file.id ? (
                    <CheckIcon fontSize="small" sx={{ color: "success.main" }} />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => setDeleteTarget(file)}
                  sx={{ color: "text.secondary" }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      )}

      <UploadDialog
        open={uploadOpen}
        token={token}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { setUploadOpen(false); fetchFiles(); }}
        enqueueSnackbar={enqueueSnackbar}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            This will permanently remove the file and its raw endpoint.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} variant="text">Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !token) return;
          const buffer = await file.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          const res = await fetch("/.netlify/functions/files", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: file.name,
              content: base64,
              mimeType: file.type || "application/octet-stream",
            }),
          });
          if (res.ok) {
            enqueueSnackbar("File uploaded", { variant: "success" });
            fetchFiles();
          } else {
            enqueueSnackbar("Upload failed", { variant: "error" });
          }
          e.target.value = "";
        }}
      />
    </Stack>
  );
}

interface UploadDialogProps {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onUploaded: () => void;
  enqueueSnackbar: (msg: string, opts: { variant: "success" | "error" | "info" }) => void;
}

function UploadDialog({ open, token, onClose, onUploaded, enqueueSnackbar }: UploadDialogProps) {
  const [mode, setMode] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async () => {
    if (!token) return;
    setIsUploading(true);

    if (mode === "url") {
      const name = fileName.trim() || `from-url-${Date.now()}`;
      const params = new URLSearchParams({ name, url });
      const res = await fetch(`/.netlify/functions/files?${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        enqueueSnackbar("File uploaded from URL", { variant: "success" });
        onUploaded();
      } else {
        const text = await res.text();
        enqueueSnackbar(text || "Upload failed", { variant: "error" });
      }
    } else {
      fileInputRef.current?.click();
    }

    setIsUploading(false);
  }, [token, mode, url, fileName, enqueueSnackbar, onUploaded]);

  // When file input fires from here, handle it
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsUploading(true);
    const buffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const res = await fetch("/.netlify/functions/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: file.name,
        content: base64,
        mimeType: file.type || "application/octet-stream",
      }),
    });
    if (res.ok) {
      enqueueSnackbar("File uploaded", { variant: "success" });
      onUploaded();
    } else {
      enqueueSnackbar("Upload failed", { variant: "error" });
    }
    setIsUploading(false);
    e.target.value = "";
  }, [token, enqueueSnackbar, onUploaded]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Upload File</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant={mode === "file" ? "contained" : "outlined"}
              size="small"
              onClick={() => setMode("file")}
              startIcon={<CloudUploadIcon />}
              sx={{ textTransform: "none" }}
            >
              From disk
            </Button>
            <Button
              variant={mode === "url" ? "contained" : "outlined"}
              size="small"
              onClick={() => setMode("url")}
              startIcon={<InsertLinkIcon />}
              sx={{ textTransform: "none" }}
            >
              From URL
            </Button>
          </Stack>

          {mode === "url" ? (
            <>
              <TextField
                label="File URL"
                variant="outlined"
                fullWidth
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/file.pdf"
              />
              <TextField
                label="File name (optional)"
                variant="outlined"
                fullWidth
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="my-file.pdf"
              />
            </>
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{
                border: "1px dashed",
                borderColor: "outline.main",
                borderRadius: 2,
                p: 4,
                cursor: "pointer",
                "&:hover": { bgcolor: "surfaceContainer.main" },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUploadIcon sx={{ fontSize: 40, color: "outline.main", mb: 1 }} />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Click to select a file
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">Cancel</Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={
            isUploading ||
            (mode === "url" && !url.trim())
          }
        >
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
      </DialogActions>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileChange}
      />
    </Dialog>
  );
}
