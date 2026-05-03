import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Typography, Button, TextField, Switch, Select, MenuItem, Card, Box, Dialog, DialogTitle, DialogContent, DialogActions, Stack } from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from 'notistack';
import RawUrlRow from '../components/RawUrlRow';
import SaveButton from '../components/SaveButton';
import { maskContent } from '../utils/mask';

interface KeyboxProps {
  token: string | null;
}

const RAW_URL = `${window.location.origin}/key`;

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
  const [source,       setSource]       = useState('yuri');
  const [savedSource,  setSavedSource]  = useState('yuri');
  const [sources,      setSources]      = useState<string[]>(['yuri']);
  const [latestPerSource, setLatestPerSource] = useState<Record<string, string>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newProvider, setNewProvider] = useState('');
  const revealTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [contentRes, metaRes, historyRes] = await Promise.all([
          fetch(RAW_URL),
          fetch(`${RAW_URL}?meta`),
          fetch('/.netlify/functions/catalog'),
        ]);

        let existingVersion: string | undefined;
        let existingSource: string | undefined;

        if (contentRes.ok) {
          const text = await contentRes.text();
          let meta: { useBase64: boolean; version?: string; source?: string } = { useBase64: true };
          try {
            if (metaRes.ok) meta = JSON.parse(await metaRes.text()) as { useBase64: boolean; version?: string; source?: string };
          } catch { /* ignore */ }
          existingVersion = meta.version;
          existingSource = meta.source;
          const decoded = meta.useBase64 ? atob(text) : text;
          setContent(decoded);
          setSavedContent(decoded);
          setUseBase64(meta.useBase64);
          setSavedBase64(meta.useBase64);
          if (meta.source) { setSource(meta.source); setSavedSource(meta.source); }
          if (meta.version) { setVersion(meta.version); setSavedVersion(meta.version); }
        }

        if (historyRes.ok) {
          const historyData = await historyRes.json() as { entries: Array<{ source: string }>; latest: Record<string, string> };
          const uniqueSources = [...new Set((historyData.entries ?? []).map(e => e.source))].sort();
          if (uniqueSources.length > 0) setSources(uniqueSources);
          if (historyData.latest) {
            setLatestPerSource(historyData.latest);
            if (!existingVersion && historyData.latest[existingSource ?? 'yuri']) {
              const autoV = String(parseInt(historyData.latest[existingSource ?? 'yuri']!, 10) + 1);
              setVersion(autoV);
              setSavedVersion(autoV);
            }
          }
        }
      } catch { /* ignore */ }
      finally {
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, useBase64, version, source }),
      });
      if (res.ok) {
        setSavedContent(content);
        setSavedBase64(useBase64);
        setSavedVersion(version);
        setSavedSource(source);
        enqueueSnackbar('Keybox saved', { variant: 'success' });
      } else {
        enqueueSnackbar('Failed to save. Try again.', { variant: 'error' });
      }
    } catch {
      enqueueSnackbar('Failed to save. Try again.', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [token, content, useBase64, version, source, enqueueSnackbar]);

  const nextVersion = (s: string) => {
    const latest = latestPerSource[s];
    return latest ? String(parseInt(latest, 10) + 1) : '';
  };

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
    () => content !== savedContent || useBase64 !== savedBase64 || version !== savedVersion || source !== savedSource,
    [content, savedContent, useBase64, savedBase64, version, savedVersion, source, savedSource],
  );

  const charCount = content.length.toLocaleString();
  const isMasked = masked && !revealed;
  const showPreview = !editing && masked && content.length > 0;
  const providerUrl = source ? `${RAW_URL}/${source}` : null;
  const versionedUrl = source && version ? `${RAW_URL}/${source}/${version}` : null;

  return (
    <Box sx={{ p: 4, maxWidth: 800 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <div>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Keybox</Typography>
          <Typography variant="body2" color="text.secondary">
            Your private keybox. {useBase64 ? 'Stored as base64.' : 'Stored as plain text.'}
          </Typography>
        </div>
        {content.length > 0 && (
          <Button variant="text" startIcon={masked ? <VisibilityOffIcon /> : <VisibilityIcon />}
            onClick={() => { setMasked(!masked); setEditing(false); setRevealed(false); }}>
            {masked ? 'Show' : 'Hide'}
          </Button>
        )}
      </Box>

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.08 }}>
          URLs
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>Latest working keybox</Typography>
        <RawUrlRow url={RAW_URL} />
        {providerUrl && <>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1.5 }}>Latest from provider</Typography>
          <RawUrlRow url={providerUrl} />
        </>}
        {versionedUrl && <>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1.5 }}>Specific version</Typography>
          <RawUrlRow url={versionedUrl} />
        </>}
      </Card>

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={3} flexWrap="wrap">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.08, minWidth: 48 }}>
              Provider
            </Typography>
            <Select value={source} onChange={(e) => {
              if (e.target.value === '__add__') {
                setAddDialogOpen(true);
              } else {
                const s = e.target.value;
                setSource(s);
                if (!version) setVersion(nextVersion(s));
              }
            }} size="small" sx={{ width: 160 }}>
              {sources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              <MenuItem value="__add__" sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 1, color: 'primary.main', fontWeight: 500 }}>
                ✚ Add a provider
              </MenuItem>
            </Select>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.08, minWidth: 40 }}>
              Version
            </Typography>
            <TextField type="number" value={version} size="small" sx={{ width: 120 }}
              onChange={(e) => setVersion(e.target.value)} />
          </Stack>
        </Stack>
      </Card>

      {isLoading ? (
        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          {[288, 24, 24].map((h, i) => (
            <Box key={i} className="skeleton" sx={{ height: h, mb: 1 }} />
          ))}
        </Card>
      ) : showPreview ? (
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
            {isMasked ? maskContent(content) : content}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            <Button variant="contained" startIcon={<VisibilityIcon />}
              onMouseDown={handleRevealStart} onMouseUp={handleRevealEnd}
              onMouseLeave={handleRevealEnd}>
              {revealed ? 'Release to hide' : 'Hold to reveal'}
            </Button>
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopy}>Copy</Button>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={handleEdit}>Edit</Button>
          </Box>
        </Card>
      ) : (
        <Card variant="outlined" className="hide-scrollbar" sx={{ p: 2, mb: 2, maxHeight: 400, overflow: 'auto' }}>
          <TextField
            variant="standard"
            multiline
            fullWidth
            minRows={12}
            placeholder="Paste your keybox here…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            inputProps={{ spellCheck: false }}
            sx={{
              "& .MuiInputBase-root": { fontFamily: '"Geist Mono", monospace', fontSize: "16px" },
            }}
          />
        </Card>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">{charCount} characters</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {editing && <Button variant="text" onClick={handleCancelEdit}>Cancel</Button>}
          <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopy}>Copy</Button>
          <Button variant="contained" startIcon={<ContentPasteIcon />} onClick={handlePaste}>Paste</Button>
          <Stack direction="row" alignItems="center" spacing={0.25} component="label">
            <Switch checked={useBase64} onChange={(e) => setUseBase64(e.target.checked)} size="small" />
            <Typography variant="body2" color="text.secondary">Base64</Typography>
          </Stack>
          <SaveButton loading={isSaving} hasUnsaved={hasUnsaved} onSave={handleSave} />
        </Box>
      </Box>

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
        <DialogTitle>Add Provider</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth placeholder="e.g. droidwin" value={newProvider}
            onChange={(e) => setNewProvider(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSource(newProvider); setAddDialogOpen(false); setNewProvider(''); }}}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => { setSource(newProvider); setAddDialogOpen(false); setNewProvider(''); }}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
