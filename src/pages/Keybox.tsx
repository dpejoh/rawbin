import { useEffect, useState, useCallback, useMemo } from "react";
import { Stack, Typography, Paper, TextField, Skeleton } from "@mui/material";
import { useSnackbar } from "notistack";
import RawUrlRow from "../components/RawUrlRow";
import SaveButton from "../components/SaveButton";

interface KeyboxProps {
  token: string | null;
}

const RAW_URL = `${window.location.origin}/.netlify/functions/raw`;

export default function Keybox({ token }: KeyboxProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(RAW_URL);
        if (res.ok) {
          const text = await res.text();
          const decoded = atob(text);
          setContent(decoded);
          setSavedContent(decoded);
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
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSavedContent(content);
        enqueueSnackbar("Keybox saved", { variant: "success" });
      } else {
        enqueueSnackbar("Failed to save. Try again.", { variant: "error" });
      }
    } catch {
      enqueueSnackbar("Failed to save. Try again.", { variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }, [token, content, enqueueSnackbar]);

  const hasUnsaved = useMemo(
    () => content !== savedContent,
    [content, savedContent]
  );

  const charCount = useMemo(
    () => content.length.toLocaleString(),
    [content]
  );

  return (
    <Stack spacing={3} sx={{ p: 4, maxWidth: 800 }}>
      <Stack>
        <Typography variant="h4" sx={{ color: "text.primary" }}>
          Keybox
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Your private keybox. Stored as base64.
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

      <Paper elevation={0} sx={{ p: 2, bgcolor: "surfaceContainer.main", borderRadius: 2 }}>
        {isLoading ? (
          <Skeleton variant="rectangular" height={288} sx={{ borderRadius: 1 }} />
        ) : (
          <TextField
            variant="standard"
            multiline
            fullWidth
            minRows={12}
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
        <SaveButton
          loading={isSaving}
          hasUnsaved={hasUnsaved}
          onSave={handleSave}
        />
      </Stack>
    </Stack>
  );
}
