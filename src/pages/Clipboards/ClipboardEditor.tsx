import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Typography,
  TextField,
  Switch,
  Button,
  Card,
  Box,
} from "@mui/material";
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from "notistack";
import RawUrlRow from "../../components/RawUrlRow";
import SaveButton from "../../components/SaveButton";
import { maskContent } from "../../utils/mask";
import { clipboardUrl } from "../../utils/clipboardUrl";
import { decodeContent } from "../../utils/decodeContent";
import type { Clipboard } from "../../hooks/useClipboards";

interface ClipboardEditorProps {
  clipboard: Clipboard;
  token: string | null;
  role: string;
  onUpdate: (token: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean }) => Promise<boolean>;
}

export default function ClipboardEditor({
  clipboard,
  token,
  role,
  onUpdate,
}: ClipboardEditorProps) {
  const { enqueueSnackbar } = useSnackbar();

  const [content, setContent] = useState(() => decodeContent(clipboard.content ?? "", clipboard.useBase64 !== false));
  const [useBase64, setUseBase64] = useState(clipboard.useBase64 !== false);
  const [savedContent, setSavedContent] = useState(() => decodeContent(clipboard.content ?? "", clipboard.useBase64 !== false));
  const [savedBase64, setSavedBase64] = useState(clipboard.useBase64 !== false);
  const [name, setName] = useState(clipboard.name);
  const [savedName, setSavedName] = useState(clipboard.name);
  const [slug, setSlug] = useState(clipboard.slug ?? "");
  const [savedSlug, setSavedSlug] = useState(clipboard.slug ?? "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [masked, setMasked] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const decoded = decodeContent(clipboard.content ?? "", clipboard.useBase64 !== false);
    setContent(decoded);
    setSavedContent(decoded);
    setUseBase64(clipboard.useBase64 !== false);
    setSavedBase64(clipboard.useBase64 !== false);
    setName(clipboard.name);
    setSavedName(clipboard.name);
    setSlug(clipboard.slug ?? "");
    setSavedSlug(clipboard.slug ?? "");
  }, [clipboard.id, clipboard.content, clipboard.name, clipboard.slug, clipboard.useBase64]);

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
    const ok = await onUpdate(token, clipboard.id, { content, useBase64 });
    if (ok) {
      setSavedContent(content);
      setSavedBase64(useBase64);
      enqueueSnackbar("Saved", { variant: "success" });
    } else {
      enqueueSnackbar("Failed to save. Try again.", { variant: "error" });
    }
    setIsSaving(false);
  }, [token, content, useBase64, clipboard.id, onUpdate, enqueueSnackbar]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      setEditing(true);
      setMasked(false);
      enqueueSnackbar('Pasted from clipboard', { variant: 'info' });
    } catch {
      enqueueSnackbar('Failed to read clipboard', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      enqueueSnackbar('Content copied', { variant: 'info' });
    } catch {
      enqueueSnackbar('Failed to copy', { variant: 'error' });
    }
  }, [content, enqueueSnackbar]);

  const handleRevealStart = useCallback(() => {
    if (revealTimeout.current) clearTimeout(revealTimeout.current);
    setRevealed(true);
  }, []);

  const handleRevealEnd = useCallback(() => {
    revealTimeout.current = setTimeout(() => setRevealed(false), 300);
  }, []);

  const handleEdit = useCallback(() => { setEditing(true); setMasked(false); }, []);
  const handleCancelEdit = useCallback(() => { setEditing(false); setMasked(true); setContent(savedContent); }, [savedContent]);

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64,
    [content, savedContent, useBase64, savedBase64]
  );

  const charCount = content.length.toLocaleString();
  const showPreview = !editing && masked && content.length > 0;
  const rawUrl = clipboardUrl(clipboard.id, savedSlug || undefined);
  const canonicalUrl = clipboardUrl(clipboard.id);

  return (
    <Box sx={{ flex: 1, p: 4, overflow: "auto", maxWidth: 800 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          {role === 'admin' && isEditingName ? (
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
              variant="h4"
              sx={{
                mb: 0.5,
                cursor: role === 'admin' ? "pointer" : "default",
                "&:hover": { color: role === 'admin' ? "primary.main" : "text.primary" },
              }}
              onClick={() => { if (role === 'admin') setIsEditingName(true); }}
            >
              {name}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Board clipboard
          </Typography>
        </Box>
        {content.length > 0 && (
          <Button variant="text" startIcon={masked ? <VisibilityOffIcon /> : <VisibilityIcon />}
            onClick={() => { setMasked(!masked); setEditing(false); setRevealed(false); }}>
            {masked ? 'Show' : 'Hide'}
          </Button>
        )}
      </Box>

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.08 }}>
          Raw URL
        </Typography>
        <RawUrlRow url={rawUrl} />
        {savedSlug && canonicalUrl !== rawUrl && (
          <Typography variant="caption" display="block" sx={{ color: "text.secondary", mt: 1 }}>
            Also available at: {canonicalUrl}
          </Typography>
        )}
      </Card>

      {role === 'admin' && (
        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.08 }}>
            Custom URL Slug
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
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
                inputProps={{ style: { fontSize: "13px", fontFamily: '"Geist Mono", monospace' } }}
                sx={{ width: 200 }}
              />
            ) : (
              <Typography
                variant="body2"
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
          </Box>
        </Card>
      )}

      {showPreview ? (
        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box component="pre" sx={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: 13,
            color: revealed ? 'text.primary' : 'text.secondary',
            lineHeight: 1.6,
            m: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            minHeight: 80,
            userSelect: revealed ? 'text' : 'none',
          }}>
            {revealed ? content : maskContent(content)}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            <Button variant="contained" startIcon={<VisibilityIcon />}
              onMouseDown={handleRevealStart} onMouseUp={handleRevealEnd}
              onMouseLeave={handleRevealEnd}>
              {revealed ? 'Release to hide' : 'Hold to reveal'}
            </Button>
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopy}>Copy</Button>
            {role === 'admin' && <Button variant="outlined" startIcon={<EditIcon />} onClick={handleEdit}>Edit</Button>}
          </Box>
        </Card>
      ) : (
        <Card variant="outlined" className="hide-scrollbar" sx={{ p: 2, mb: 2, maxHeight: 400, overflow: 'auto' }}>
          <TextField
            variant="standard"
            multiline
            fullWidth
            minRows={12}
            placeholder="Start typing…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            inputProps={{ spellCheck: false, readOnly: role !== 'admin' }}
            sx={{
              "& .MuiInputBase-root": { fontFamily: '"Geist Mono", monospace', fontSize: "16px" },
              "& .MuiInputBase-input.Mui-readOnly": { color: 'text.secondary' },
            }}
          />
        </Card>
      )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {charCount} characters
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {role === 'admin' && editing && <Button variant="text" onClick={handleCancelEdit}>Cancel</Button>}
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopy}>Copy</Button>
            {role === 'admin' && (
              <>
                <Button variant="contained" startIcon={<ContentPasteIcon />} onClick={handlePaste}>Paste</Button>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Switch
                    checked={useBase64}
                    onChange={(e) => setUseBase64(e.target.checked)}
                    size="small"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Base64
                  </Typography>
                </Box>
                <SaveButton
                  loading={isSaving}
                  hasUnsaved={hasUnsaved}
                  onSave={handleSaveContent}
                />
              </>
            )}
          </Box>
        </Box>
    </Box>
  );
}
