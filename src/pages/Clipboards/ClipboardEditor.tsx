import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Stack,
  Typography,
  TextField,
  Skeleton,
} from "@mui/material";
import { useSnackbar } from "notistack";
import RawUrlRow from "../../components/RawUrlRow";
import SaveButton from "../../components/SaveButton";
import type { Clipboard } from "../../hooks/useClipboards";

interface ClipboardEditorProps {
  clipboard: Clipboard;
  token: string | null;
  onUpdate: (token: string, id: string, data: { name?: string; content?: string }) => Promise<boolean>;
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(clipboard.content ?? "");
    setSavedContent(clipboard.content ?? "");
    setName(clipboard.name);
    setSavedName(clipboard.name);
  }, [clipboard.id, clipboard.content, clipboard.name]);

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

  const rawUrl = `${window.location.origin}/.netlify/functions/clipboards/${clipboard.id}`;

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
