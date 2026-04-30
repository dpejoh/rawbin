import { useEffect, useState, useCallback, useMemo } from "react";
import { Stack, Typography, Button, Skeleton, useMediaQuery, Fab, Box } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import { useSnackbar } from "notistack";
import ClipboardList from "./ClipboardList";
import ClipboardEditor from "./ClipboardEditor";
import CreateDialog from "./CreateDialog";
import DeleteDialog from "./DeleteDialog";
import useClipboards from "../../hooks/useClipboards";

interface ClipboardsPageProps {
  token: string | null;
}

export default function ClipboardsPage({ token }: ClipboardsPageProps) {
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
    fetchRawContent,
  } = useClipboards();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [contentCache, setContentCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (token) fetchAll(token);
  }, [token, fetchAll]);

  const handleSelect = useCallback(
    async (id: string) => {
      select(id);
      if (isMobile) setMobileEditorOpen(true);

      if (!contentCache[id]) {
        const c = await fetchRawContent(id);
        setContentCache((prev) => ({ ...prev, [id]: c }));
        // patch the clipboard in the list with content
        const cb = clipboards.find((c) => c.id === id);
        if (cb) {
          // We need to update selected content - handled by ClipboardEditor via contentCache
        }
      }
    },
    [select, isMobile, contentCache, fetchRawContent, clipboards]
  );

  const handleCreate = useCallback(
    async (name: string) => {
      if (!token) return;
      const id = await create(token, name);
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
    async (tok: string, id: string, data: { name?: string; content?: string }): Promise<boolean> => {
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

  const handleRename = useCallback(
    (id: string) => {
      // on mobile, open the editor so they can click the title
      if (isMobile) {
        select(id);
        setMobileEditorOpen(true);
      }
    },
    [isMobile, select]
  );

  const handleCopyUrl = useCallback(
    async (id: string) => {
      const url = `${window.location.origin}/.netlify/functions/clipboards/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        enqueueSnackbar("Raw URL copied", { variant: "info" });
      } catch {
        enqueueSnackbar("Failed to copy", { variant: "error" });
      }
    },
    [enqueueSnackbar]
  );

  const selectedClipboardWithContent = useMemo(() => {
    if (!selected) return null;
    return {
      ...selected,
      content: contentCache[selected.id] ?? selected.content ?? "",
    };
  }, [selected, contentCache]);

  if (isMobile && mobileEditorOpen && selectedClipboardWithContent) {
    return (
      <Box sx={{ height: "100%", overflow: "auto", pb: 7 }}>
        <Button
          onClick={() => setMobileEditorOpen(false)}
          sx={{ m: 1, textTransform: "none" }}
        >
          &larr; Back
        </Button>
        <ClipboardEditor
          clipboard={selectedClipboardWithContent}
          token={token}
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{ textTransform: "none" }}
        >
          New Clipboard
        </Button>
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ textTransform: "none" }}
          >
            Create your first clipboard
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" sx={{ flex: 1, overflow: "hidden" }}>
          <ClipboardList
            clipboards={clipboards}
            selectedId={selected?.id ?? null}
            isLoading={isLoading}
            onSelect={handleSelect}
            onRename={handleRename}
            onCopyUrl={handleCopyUrl}
            onDelete={(id) => {
              const cb = clipboards.find((c) => c.id === id);
              if (cb) setDeleteTarget({ id, name: cb.name });
            }}
          />
          {selectedClipboardWithContent && !isMobile && (
            <ClipboardEditor
              clipboard={selectedClipboardWithContent}
              token={token}
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
