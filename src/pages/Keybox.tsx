import { useEffect, useState, useCallback, useMemo } from "react";
import { Stack, Typography, Paper, TextField, Skeleton, Switch, FormControlLabel, Button } from "@mui/material";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import { useSnackbar } from "notistack";
import RawUrlRow from "../components/RawUrlRow";
import SaveButton from "../components/SaveButton";

interface KeyboxProps {
  token: string | null;
}

const RAW_URL = `${window.location.origin}/key`;

export default function Keybox({ token }: KeyboxProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [useBase64, setUseBase64] = useState(true);
  const [savedBase64, setSavedBase64] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [contentRes, metaRes] = await Promise.all([
          fetch(RAW_URL),
          fetch(`${RAW_URL}?meta`),
        ]);
        if (contentRes.ok) {
          const text = await contentRes.text();
          let meta = { useBase64: true };
          try {
            if (metaRes.ok) meta = JSON.parse(await metaRes.text()) as { useBase64: boolean };
          } catch { /* ignore */ }
          const decoded = meta.useBase64 ? atob(text) : text;
          setContent(decoded);
          setSavedContent(decoded);
          setUseBase64(meta.useBase64);
          setSavedBase64(meta.useBase64);
        }
      } catch {
        // no content yet
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch("/.netlify/functions/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, useBase64 }),
      });
      if (res.ok) {
        setSavedContent(content);
        setSavedBase64(useBase64);
        enqueueSnackbar("Keybox saved", { variant: "success" });
      } else {
        enqueueSnackbar("Failed to save. Try again.", { variant: "error" });
      }
    } catch {
      enqueueSnackbar("Failed to save. Try again.", { variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }, [token, content, useBase64, enqueueSnackbar]);

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64,
    [content, savedContent, useBase64, savedBase64]
  );

  const charCount = useMemo(
    () => content.length.toLocaleString(),
    [content]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      enqueueSnackbar("Pasted from clipboard", { variant: "info" });
    } catch {
      enqueueSnackbar("Failed to read clipboard", { variant: "error" });
    }
  }, [enqueueSnackbar]);

  return (
    <Stack spacing={3} sx={{ p: 4, maxWidth: 800 }}>
      <Stack>
        <Typography variant="h4" sx={{ color: "text.primary" }}>
          Keybox
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Your private keybox. {useBase64 ? "Stored as base64." : "Stored as plain text."}
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{ p: 2, bgcolor: "surfaceContainer.main", borderRadius: 2 }}
      >
        <Typography variant="caption" sx={{ color: "outline.main", mb: 0.5, display: "block", fontSize: "11px", fontWeight: 500 }}>
          RAW URL
        </Typography>
        <RawUrlRow url={RAW_URL} />
      </Paper>

      <Paper elevation={0} sx={{ p: 2, bgcolor: "surfaceContainer.main", borderRadius: 2, maxHeight: 400, overflow: "auto" }}>
        {isLoading ? (
          <Skeleton variant="rectangular" height={288} sx={{ borderRadius: 1 }} />
        ) : (
          <TextField
            variant="standard"
            multiline
            fullWidth
            minRows={12}
            maxRows={20}
            placeholder="Paste your keybox here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            inputProps={{ spellCheck: false }}
            sx={{
              "& .MuiInputBase-root": { fontFamily: '"Geist Mono", monospace', fontSize: "16px" },
            }}
          />
        )}
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {charCount} characters
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentPasteIcon />}
            onClick={handlePaste}
            sx={{ textTransform: "none" }}
          >
            Paste
          </Button>
          <FormControlLabel
            control={
              <Switch
                checked={useBase64}
                onChange={(e) => setUseBase64(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Base64
              </Typography>
            }
          />
          <SaveButton
            loading={isSaving}
            hasUnsaved={hasUnsaved}
            onSave={handleSave}
          />
        </Stack>
      </Stack>
    </Stack>
  );
}
