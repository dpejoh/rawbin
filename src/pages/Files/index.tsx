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
  Breadcrumbs,
  Link,
  Box,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertLinkIcon from "@mui/icons-material/InsertLink";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
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
  parentId: string;
  isFolder?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FolderBreadcrumb {
  id: string;
  name: string;
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

function fileIcon(mimeType: string, isFolder?: boolean) {
  if (isFolder) return <FolderIcon />;
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
  const [allItems, setAllItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [folderPath, setFolderPath] = useState<FolderBreadcrumb[]>(() => {
    try {
      const stored = localStorage.getItem("keybox:folderPath");
      if (stored) {
        const parsed = JSON.parse(stored) as FolderBreadcrumb[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [{ id: "", name: "Files" }];
  });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolderId = folderPath[folderPath.length - 1]?.id ?? "";
  const hasParent = currentFolderId !== "";
  const visibleItems = allItems.filter((f) => f.parentId === currentFolderId);

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/.netlify/functions/files", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as FileItem[];
        setAllItems(data);
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

  useEffect(() => { localStorage.setItem("keybox:folderPath", JSON.stringify(folderPath)); }, [folderPath]);

  const enterFolder = useCallback((id: string, name: string) => {
    setFolderPath((prev) => [...prev, { id, name }]);
  }, []);

  const navigateBreadcrumb = useCallback((index: number) => {
    setFolderPath((prev) => prev.slice(0, index + 1));
  }, []);

  const goBack = useCallback(() => {
    setFolderPath((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

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
      enqueueSnackbar("Deleted", { variant: "success" });
      fetchFiles();
    } else {
      enqueueSnackbar("Failed to delete", { variant: "error" });
    }
    setDeleteTarget(null);
  }, [token, deleteTarget, enqueueSnackbar, fetchFiles]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!token) return;
    const res = await fetch("/.netlify/functions/files?folder=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    });
    if (res.ok) {
      enqueueSnackbar("Folder created", { variant: "success" });
      fetchFiles();
    } else {
      const text = await res.text();
      enqueueSnackbar(text || "Failed to create folder", { variant: "error" });
    }
  }, [token, currentFolderId, enqueueSnackbar, fetchFiles]);

  const uploadFile = useCallback(async (file: File) => {
    if (!token) return;
    const base64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
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
        parentId: currentFolderId,
      }),
    });
    if (!res.ok) throw new Error("Upload failed");
  }, [token, currentFolderId]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      await uploadFile(file);
      enqueueSnackbar("File uploaded", { variant: "success" });
      fetchFiles();
    } catch {
      enqueueSnackbar("Upload failed", { variant: "error" });
    }
    e.target.value = "";
  }, [token, uploadFile, enqueueSnackbar, fetchFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(0);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    let success = 0;
    let fail = 0;
    for (const file of files) {
      try {
        await uploadFile(file);
        success++;
      } catch {
        fail++;
      }
    }
    fetchFiles();
    if (fail === 0) {
      enqueueSnackbar(`${success} file${success !== 1 ? "s" : ""} uploaded`, { variant: "success" });
    } else {
      enqueueSnackbar(`${success} uploaded, ${fail} failed`, { variant: "error" });
    }
  }, [uploadFile, fetchFiles, enqueueSnackbar]);

  const totalSize = visibleItems.reduce((acc, f) => acc + f.size, 0);
  const fileCount = visibleItems.filter((f) => !f.isFolder).length;
  const folderCount = visibleItems.filter((f) => f.isFolder).length;

  return (
    <Box
      sx={{ position: "relative", minHeight: "100%" }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDragEnter={(e) => { e.preventDefault(); setIsDragging((n) => n + 1); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging((n) => n - 1); }}
      onDrop={handleDrop}
    >
      {isDragging > 0 && (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            position: "absolute", inset: 0, zIndex: 9999,
            bgcolor: "rgba(17,19,24,0.85)",
            border: "2px dashed",
            borderColor: "primary.main",
            borderRadius: 2, m: 1,
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 64, color: "primary.main", mb: 2 }} />
          <Typography variant="h5" sx={{ color: "primary.main" }}>Drop files here</Typography>
        </Stack>
      )}

      <Stack spacing={3} sx={{ p: 4, maxWidth: 800 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack>
            <Breadcrumbs
              sx={{ "& .MuiBreadcrumbs-separator": { color: "outline.main" } }}
            >
              {folderPath.map((crumb, i) => (
                <Link
                  key={crumb.id || "root"}
                  underline={i < folderPath.length - 1 ? "hover" : "none"}
                  onClick={() => navigateBreadcrumb(i)}
                  sx={{
                    color: i === folderPath.length - 1 ? "text.primary" : "primary.main",
                    cursor: i < folderPath.length - 1 ? "pointer" : "default",
                    fontSize: "22px",
                    fontWeight: 400,
                  }}
                >
                  {crumb.name}
                </Link>
              ))}
            </Breadcrumbs>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="New folder">
              <Button
                variant="outlined"
                startIcon={<CreateNewFolderIcon />}
                onClick={() => setFolderOpen(true)}
                sx={{ textTransform: "none" }}
                size="small"
              >
                Folder
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setUploadOpen(true)}
              sx={{ textTransform: "none" }}
              size="small"
            >
              Upload
            </Button>
          </Stack>
        </Stack>

        {visibleItems.length > 0 && (
          <Stack direction="row" alignItems="center" spacing={1}>
            {hasParent && (
              <IconButton size="small" onClick={goBack} sx={{ color: "text.secondary" }}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {[
                folderCount > 0 && `${folderCount} folder${folderCount > 1 ? "s" : ""}`,
                fileCount > 0 && `${fileCount} file${fileCount > 1 ? "s" : ""}`,
              ].filter(Boolean).join(" · ")}
              {visibleItems.length > 0 && ` · ${formatSize(totalSize)} total`}
            </Typography>
          </Stack>
        )}

        {isLoading ? (
          <Stack spacing={1}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: 1 }} />
            ))}
          </Stack>
        ) : visibleItems.length === 0 && !hasParent ? (
          <Stack alignItems="center" justifyContent="center" sx={{ gap: 2, py: 8 }}>
            <CloudUploadIcon sx={{ fontSize: 64, color: "outline.main" }} />
            <Typography variant="h5" sx={{ color: "text.primary" }}>
              No files yet
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
              Upload a file, fetch from a URL, or drop files anywhere on this page.
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
        ) : visibleItems.length === 0 && hasParent ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
            This folder is empty
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {visibleItems.map((file) => (
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
                  cursor: file.isFolder ? "pointer" : "default",
                }}
                onClick={() => file.isFolder && enterFolder(file.id, file.name)}
              >
                <Stack sx={{ color: file.isFolder ? "primary.main" : "text.secondary", fontSize: 20 }}>
                  {fileIcon(file.mimeType, file.isFolder)}
                </Stack>

                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ color: "text.primary" }}>
                    {file.name}
                  </Typography>
                  {!file.isFolder && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {formatSize(file.size)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "outline.main" }}>·</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {relativeTime(file.createdAt)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                {!file.isFolder && (
                  <Tooltip title="Copy raw URL">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleCopyUrl(file.id); }}
                      sx={{ color: "text.secondary" }}
                    >
                      {copiedId === file.id ? (
                        <CheckIcon fontSize="small" sx={{ color: "success.main" }} />
                      ) : (
                        <ContentCopyIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); }}
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
          currentFolderId={currentFolderId}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => { setUploadOpen(false); fetchFiles(); }}
          enqueueSnackbar={enqueueSnackbar}
        />

        <CreateFolderDialog
          open={folderOpen}
          onClose={() => setFolderOpen(false)}
          onCreate={handleCreateFolder}
        />

        <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle>
            Delete {deleteTarget?.isFolder ? "folder" : "file"} &ldquo;{deleteTarget?.name}&rdquo;?
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {deleteTarget?.isFolder
                ? "This will permanently remove the folder and all its contents."
                : "This will permanently remove the file and its raw endpoint."}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)} variant="text">Cancel</Button>
            <Button onClick={handleDelete} variant="contained" color="error">Delete</Button>
          </DialogActions>
        </Dialog>

        <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />
      </Stack>
    </Box>
  );
}

interface UploadDialogProps {
  open: boolean;
  token: string | null;
  currentFolderId: string;
  onClose: () => void;
  onUploaded: () => void;
  enqueueSnackbar: (msg: string, opts: { variant: "success" | "error" | "info" }) => void;
}

function UploadDialog({ open, token, currentFolderId, onClose, onUploaded, enqueueSnackbar }: UploadDialogProps) {
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
      const params = new URLSearchParams({ name, url, parentId: currentFolderId });
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
  }, [token, mode, url, fileName, currentFolderId, enqueueSnackbar, onUploaded]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsUploading(true);
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    const base64 = btoa(binary);
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
        parentId: currentFolderId,
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
  }, [token, currentFolderId, enqueueSnackbar, onUploaded]);

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
          disabled={isUploading || (mode === "url" && !url.trim())}
        >
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
      </DialogActions>

      <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
    </Dialog>
  );
}

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

function CreateFolderDialog({ open, onClose, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState("");

  const handleCreate = useCallback(() => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
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
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">Cancel</Button>
        <Button onClick={handleCreate} variant="contained" disabled={!name.trim()}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}
