import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Paper,
  Typography,
  Button,
  IconButton,
  Switch,
  TextField,
  Box,
} from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';
import { useSnackbar } from 'notistack';
import RawUrlRow from '../components/RawUrlRow';
import SaveButton from '../components/SaveButton';

interface KeyboxProps {
  token: string | null;
}

const RAW_URL = `${window.location.origin}/key`;

function maskContent(text: string): string {
  if (!text) return '';
  if (text.length <= 16) return '\u2022'.repeat(text.length);
  const first = text.slice(0, 8);
  const last = text.slice(-8);
  const dots = '\u2022'.repeat(Math.min(text.length - 16, 64));
  return first + dots + '\n' + '\u2022'.repeat(Math.min(text.length, 32)) + '\n' + last;
}

export default function Keybox({ token }: KeyboxProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [content,      setContent]      = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [useBase64,    setUseBase64]    = useState(true);
  const [savedBase64,  setSavedBase64]  = useState(true);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSaving,     setIsSaving]     = useState(false);
  const [masked,       setMasked]       = useState(true);
  const [revealed,     setRevealed]     = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [version,      setVersion]      = useState('');
  const [savedVersion, setSavedVersion] = useState('');
  const [versionEditable, setVersionEditable] = useState(false);
  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [contentRes, metaRes] = await Promise.all([
          fetch(RAW_URL),
          fetch(`${RAW_URL}?meta`),
        ]);
        if (contentRes.ok) {
          const text = await contentRes.text();
          let meta: { useBase64: boolean; version?: string } = { useBase64: true };
          try {
            if (metaRes.ok) meta = JSON.parse(await metaRes.text()) as { useBase64: boolean; version?: string };
          } catch { /* ignore */ }
          const decoded = meta.useBase64 ? atob(text) : text;
          setContent(decoded);
          setSavedContent(decoded);
          setUseBase64(meta.useBase64);
          setSavedBase64(meta.useBase64);
          if (meta.version) {
            setVersion(meta.version);
            setSavedVersion(meta.version);
          }
        }
      } catch { /* no content yet */ }
      finally {
        if (!savedVersion) {
          try {
            const historyRes = await fetch('/.netlify/functions/history');
            if (historyRes.ok) {
              const data = await historyRes.json() as { latest?: string };
              const next = data.latest ? String(parseInt(data.latest, 10)) : '1';
              setVersion(next);
              setSavedVersion(next);
            }
          } catch { setVersion('1'); setSavedVersion('1'); }
        }
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch('/.netlify/functions/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, useBase64, version }),
      });
      if (res.ok) {
        setSavedContent(content);
        setSavedBase64(useBase64);
        setSavedVersion(version);
        enqueueSnackbar('Keybox saved', { variant: 'success' });
      } else {
        enqueueSnackbar('Failed to save. Try again.', { variant: 'error' });
      }
    } catch {
      enqueueSnackbar('Failed to save. Try again.', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [token, content, useBase64, version, enqueueSnackbar]);

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

  const handleEdit = useCallback(() => {
    setEditing(true);
    setMasked(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setMasked(true);
    setContent(savedContent);
  }, [savedContent]);

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64 || version !== savedVersion,
    [content, savedContent, useBase64, savedBase64, version, savedVersion],
  );

  const charCount = useMemo(() => content.length.toLocaleString(), [content]);
  const showPreview = !editing && masked && content.length > 0;
  const versionedUrl = version ? `${RAW_URL}/${version}` : null;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Typography variant="h4" sx={{ color: 'text.primary', mb: 0.5 }}>
            Keybox
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Your private keybox. {useBase64 ? 'Stored as base64.' : 'Stored as plain text.'}
          </Typography>
        </div>
        {content.length > 0 && (
          <Button
            variant="text"
            startIcon={masked ? <VisibilityIcon /> : <VisibilityOffIcon />}
            onClick={() => { setMasked(!masked); setEditing(false); setRevealed(false); }}
            sx={{ textTransform: 'none', flexShrink: 0 }}
          >
            {masked ? 'Show' : 'Hide'}
          </Button>
        )}
      </div>

      <Paper elevation={0} sx={{ p: 2, bgcolor: 'surfaceContainer.main', borderRadius: 2, mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'outline.main', display: 'block', mb: 0.5, fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Latest URL
        </Typography>
        <RawUrlRow url={RAW_URL} />
        {versionedUrl && (
          <>
            <Typography variant="caption" sx={{ color: 'outline.main', display: 'block', mt: 1.5, mb: 0.5, fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Versioned URL
            </Typography>
            <RawUrlRow url={versionedUrl} />
          </>
        )}
      </Paper>

      <Paper elevation={0} sx={{ p: 2, bgcolor: 'surfaceContainer.main', borderRadius: 2, mb: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: 'outline.main', display: 'block', mb: 0.5, fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Keybox Version
            </Typography>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TextField
                type="number"
                size="small"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={!versionEditable}
                sx={{ width: 120, '& .MuiInputBase-input': { fontFamily: '"Geist Mono", monospace' } }}
                InputProps={{
                  endAdornment: !versionEditable ? (
                    <IconButton size="small" onClick={() => setVersionEditable(true)} sx={{ p: 0.5 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  ) : undefined,
                }}
              />
              {!versionEditable && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Auto-calculated
                </Typography>
              )}
            </div>
          </div>
        </div>
      </Paper>

      {isLoading ? (
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'surfaceContainer.main', borderRadius: 2, mb: 2, maxHeight: 400, overflow: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[288, 24, 24].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h }} />
            ))}
          </div>
        </Paper>
      ) : showPreview ? (
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'surfaceContainer.main', borderRadius: 2, mb: 2 }}>
          <Box
            component="pre"
            sx={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: '13px',
              color: revealed ? 'text.primary' : 'outline.main',
              lineHeight: 1.6,
              m: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              minHeight: 80,
              userSelect: revealed ? 'text' : 'none',
            }}
          >
            {revealed ? content : maskContent(content)}
          </Box>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button
              variant="contained"
              startIcon={<VisibilityIcon />}
              onMouseDown={handleRevealStart}
              onMouseUp={handleRevealEnd}
              onMouseLeave={handleRevealEnd}
              onTouchStart={handleRevealStart}
              onTouchEnd={handleRevealEnd}
              sx={{ textTransform: 'none' }}
            >
              {revealed ? 'Release to hide' : 'Hold to reveal'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              sx={{ textTransform: 'none' }}
            >
              Copy
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEdit}
              sx={{ textTransform: 'none' }}
            >
              Edit
            </Button>
          </div>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'surfaceContainer.main', borderRadius: 2, mb: 2, maxHeight: 400, overflow: 'auto' }}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              fontFamily: "'Geist Mono', monospace",
              fontSize: '16px',
              color: 'inherit',
              lineHeight: 1.5,
              minHeight: 200,
            }}
            rows={12}
            placeholder="Paste your keybox here…"
          />
        </Paper>
      )}

      <div className="save-row">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {charCount} characters
        </Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editing && (
            <Button variant="text" onClick={handleCancelEdit} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentPasteIcon />}
            onClick={handlePaste}
            sx={{ textTransform: 'none' }}
          >
            Paste
          </Button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <Switch
              checked={useBase64}
              onChange={(e) => setUseBase64(e.target.checked)}
              size="small"
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Base64
            </Typography>
          </label>
          <SaveButton
            loading={isSaving}
            hasUnsaved={hasUnsaved}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
