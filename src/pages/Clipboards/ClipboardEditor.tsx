import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Stack,
  Typography,
  TextField,
} from "@mui/material";
import { useSnackbar } from "notistack";
import RawUrlRow from "../../components/RawUrlRow";
import SaveButton from "../../components/SaveButton";
import type { Clipboard } from "../../hooks/useClipboards";

function clipboardUrl(id: string, slug?: string): string {
  const path = slug ? `/clips/${slug}` : `/clips/${id}`;
  return `${window.location.origin}${path}`;
}

interface ClipboardEditorProps {
  clipboard: Clipboard;
  token: string | null;
  onUpdate: (token: string, id: string, data: { name?: string; content?: string; slug?: string }) => Promise<boolean>;
}

export default function ClipboardEditor({
  clipboard,
  token,
  onUpdate,
}: ClipboardEditorProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [content, setContent] = useState(clipboard.content ?? "");
  const [savedContent, setSavedContent] = useState(clipboard.content ?? "");
  const [name, setName] = useState(clipboard.name);
  const [savedName, setSavedName] = useState(clipboard.name);
  const [slug, setSlug] = useState(clipboard.slug ?? "");
  const [savedSlug, setSavedSlug] = useState(clipboard.slug ?? "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(clipboard.content ?? "");
    setSavedContent(clipboard.content ?? "");
    setName(clipboard.name);
    setSavedName(clipboard.name);
    setSlug(clipboard.slug ?? "");
    setSavedSlug(clipboard.slug ?? "");
  }, [clipboard.id, clipboard.content, clipboard.name, clipboard.slug]);

  const handleSaveName = useCallback(async () => {
    if (!token || name === savedName) {
      setIsEditingName(false);
      return;
    }
    const ok = await onUpdate(token, clipboard.id, { name });
    if (ok) {
      setSavedName(name);
      enqueueSnackbar("Renamed", { variant: "success" });
    } else {
      enqueueSnackbar("Failed to rename", { variant: "error" });
    }
    setIsEditingName(false);
  }, [token, name, savedName, clipboard.id, onUpdate, enqueueSnackbar]);

  const handleSaveSlug = useCallback(async () => {
    if (!token || slug === savedSlug) {
      setIsEditingSlug(false);
      return;
    }
    const ok = await onUpdate(token, clipboard.id, { slug: slug || undefined });
    if (ok) {
      setSavedSlug(slug);
      enqueueSnackbar("Custom URL updated", { variant: "success" });
    } else {
      enqueueSnackbar("Failed to update URL", { variant: "error" });
    }
    setIsEditingSlug(false);
  }, [token, slug, savedSlug, clipboard.id, onUpdate, enqueueSnackbar]);

  const handleSaveContent = useCallback(async () => {
    if (!token) return;
    setIsSaving(true);
    const ok = await onUpdate(token, clipboard.id, { content });
    if (ok) {
      setSavedContent(content);
      enqueueSnackbar("Saved", { variant: "success" });
    } else {
      enqueueSnackbar("Failed to save. Try again.", { variant: "error" });
    }
    setIsSaving(false);
  }, [token, content, clipboard.id, onUpdate, enqueueSnackbar]);

  const hasUnsaved = useMemo(
    () => content !== savedContent,
    [content, savedContent]
  );

  const charCount = useMemo(
    () => content.length.toLocaleString(),
    [content]
  );

  const rawUrl = clipboardUrl(clipboard.id, savedSlug || undefined);
  const canonicalUrl = clipboardUrl(clipboard.id);

  return (
    <Stack spacing={3} sx={{ flex: 1, p: 4, overflow: "auto" }}>
      <Stack>
        {isEditingName ? (
          <TextField
            variant="standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveName();
              if (e.key === "Escape") {
                setName(savedName);
                setIsEditingName(false);
              }
            }}
            autoFocus
            sx={{
              "& .MuiInputBase-input": {
                fontSize: "22px",
                fontWeight: 400,
                fontFamily: '"Geist Mono", monospace',
              },
            }}
          />
        ) : (
          <Typography
            variant="h6"
            sx={{
              color: "text.primary",
              cursor: "pointer",
              "&:hover": { color: "primary.main" },
            }}
            onClick={() => setIsEditingName(true)}
          >
            {name}
          </Typography>
        )}
      </Stack>

      <RawUrlRow url={rawUrl} />

      {savedSlug && canonicalUrl !== rawUrl && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Also available at: {canonicalUrl}
        </Typography>
      )}

      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
          Custom URL:
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          /clips/
        </Typography>
        {isEditingSlug ? (
          <TextField
            variant="standard"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={handleSaveSlug}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveSlug();
              if (e.key === "Escape") {
                setSlug(savedSlug);
                setIsEditingSlug(false);
              }
            }}
            autoFocus
            size="small"
            placeholder="custom-slug"
            inputProps={{ style: { fontSize: "12px", fontFamily: '"Geist Mono", monospace' } }}
            sx={{ width: 200 }}
          />
        ) : (
          <Typography
            variant="caption"
            sx={{
              color: slug ? "primary.main" : "text.secondary",
              cursor: "pointer",
              fontFamily: '"Geist Mono", monospace',
              "&:hover": { textDecoration: "underline" },
            }}
            onClick={() => setIsEditingSlug(true)}
          >
            {slug || "set custom URL..."}
          </Typography>
        )}
      </Stack>

      <TextField
        variant="standard"
        multiline
        fullWidth
        minRows={10}
        placeholder="Start typing..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        inputProps={{ spellCheck: false }}
        sx={{
          "& .MuiInputBase-root": { fontFamily: '"Geist Mono", monospace', fontSize: "16px" },
        }}
      />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {charCount} characters
        </Typography>
        <SaveButton
          loading={isSaving}
          hasUnsaved={hasUnsaved}
          onSave={handleSaveContent}
        />
      </Stack>
    </Stack>
  );
}
