import { useEffect, useState, useCallback, useRef } from "react";
import { Stack, Typography, Button, useMediaQuery, Box } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import { useSnackbar } from "notistack";
import ClipboardList from "./ClipboardList";
import ClipboardEditor from "./ClipboardEditor";
import CreateDialog from "./CreateDialog";
import DeleteDialog from "./DeleteDialog";
import useClipboards from "../../hooks/useClipboards";
import { clipboardUrl } from "../../utils/clipboardUrl";

interface ClipboardsPageProps {
  token: string | null;
  role: string;
}

export default function ClipboardsPage({ token, role }: ClipboardsPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const isMobile = useMediaQuery("(max-width: 899px)");
  const {
    clipboards,
    selected,
    isLoading,
    fetchAll,
    select,
    create,
    update,
    remove,
  } = useClipboards();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const hasRestored = useRef(false);

  useEffect(() => {
    if (token) fetchAll(token);
  }, [token, fetchAll]);

  useEffect(() => {
    if (clipboards.length > 0 && !hasRestored.current) {
      hasRestored.current = true;
      const storedId = localStorage.getItem("keybox:clipboardId");
      if (storedId && clipboards.some((c) => c.id === storedId)) {
        select(storedId);
      }
    }
  }, [clipboards, select]);

  useEffect(() => {
    if (selected) {
      localStorage.setItem("keybox:clipboardId", selected.id);
    } else {
      localStorage.removeItem("keybox:clipboardId");
    }
  }, [selected]);

  const handleSelect = useCallback(
    (id: string) => {
      select(id);
      if (isMobile) setMobileEditorOpen(true);
    },
    [select, isMobile]
  );

  const handleCreate = useCallback(
    async (name: string, slug?: string) => {
      if (!token) return;
      const id = await create(token, name, slug);
      if (id) {
        enqueueSnackbar("Clipboard created", { variant: "success" });
        select(id);
        if (isMobile) setMobileEditorOpen(true);
      } else {
        enqueueSnackbar("Failed to create clipboard", { variant: "error" });
      }
    },
    [token, create, select, isMobile, enqueueSnackbar]
  );

  const handleUpdate = useCallback(
    async (tok: string, id: string, data: { name?: string; content?: string; slug?: string }): Promise<boolean> => {
      const ok = await update(tok, id, data);
      return ok;
    },
    [update]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!token) return;
      const ok = await remove(token, id);
      if (ok) {
        enqueueSnackbar("Clipboard deleted", { variant: "success" });
        setMobileEditorOpen(false);
      } else {
        enqueueSnackbar("Failed to delete clipboard", { variant: "error" });
      }
      setDeleteTarget(null);
    },
    [token, remove, enqueueSnackbar]
  );

  const handleBatchDelete = useCallback(
    async (ids: string[]) => {
      if (!token) return;
      let ok = 0; let fail = 0;
      for (const id of ids) {
        const res = await remove(token, id);
        if (res) ok++; else fail++;
      }
      enqueueSnackbar(`Deleted ${ok} clipboard${ok !== 1 ? 's' : ''}${fail > 0 ? ` (${fail} failed)` : ''}`, { variant: fail === 0 ? 'success' : 'error' });
    },
    [token, remove, enqueueSnackbar]
  );

  const handleCopyUrl = useCallback(
    async (id: string) => {
      const cb = clipboards.find((c) => c.id === id);
      const url = clipboardUrl(id, cb?.slug);
      try {
        await navigator.clipboard.writeText(url);
        enqueueSnackbar("Raw URL copied", { variant: "info" });
      } catch {
        enqueueSnackbar("Failed to copy", { variant: "error" });
      }
    },
    [clipboards, enqueueSnackbar]
  );

  if (isMobile && mobileEditorOpen && selected) {
    return (
      <Box sx={{ height: "100%", overflow: "auto", pb: 7 }}>
        <Button
          onClick={() => setMobileEditorOpen(false)}
          sx={{ m: 1, textTransform: "none" }}
        >
          &larr; Back
        </Button>
        <ClipboardEditor
          clipboard={selected}
          token={token}
          role={role}
          onUpdate={handleUpdate}
        />
      </Box>
    );
  }

  const isEmpty = !isLoading && clipboards.length === 0;

  return (
    <Stack sx={{ height: "100%", pb: isMobile ? 7 : 0 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 3, pt: 3, pb: 2 }}
      >
        <Stack>
          <Typography variant="h4" sx={{ color: "text.primary" }}>
            Clipboards
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Freeform text storage with raw endpoints.
          </Typography>
        </Stack>
        {role === "admin" && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ textTransform: "none" }}
          >
            New Clipboard
          </Button>
        )}
      </Stack>

      {isEmpty ? (
        <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, gap: 2, pb: 8 }}>
          <ContentPasteIcon sx={{ fontSize: 64, color: "outline.main" }} />
          <Typography variant="h5" sx={{ color: "text.primary" }}>
            No clipboards yet
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Create one to start storing text with its own raw URL endpoint.
          </Typography>
          {role === "admin" && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{ textTransform: "none" }}
            >
              Create your first clipboard
            </Button>
          )}
        </Stack>
      ) : (
        <Stack direction="row" sx={{ flex: 1, overflow: "hidden" }}>
          <ClipboardList
            clipboards={clipboards}
            selectedId={selected?.id ?? null}
            isLoading={isLoading}
            role={role}
            onSelect={handleSelect}
            onCopyUrl={handleCopyUrl}
            onDelete={(id) => {
              const cb = clipboards.find((c) => c.id === id);
              if (cb) setDeleteTarget({ id, name: cb.name });
            }}
            onBatchDelete={handleBatchDelete}
          />
          {selected && !isMobile && (
            <ClipboardEditor
              clipboard={selected}
              token={token}
              role={role}
              onUpdate={handleUpdate}
            />
          )}
        </Stack>
      )}

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <DeleteDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </Stack>
  );
}
