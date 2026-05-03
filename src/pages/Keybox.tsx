import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Typography, Button, TextField, Switch, Select, MenuItem, Card, Box, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
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

        if (historyRes.ok) {
          const historyData = await historyRes.json() as { entries: Array<{ source: string }>; latest: Record<string, string> };
          const uniqueSources = [...new Set((historyData.entries ?? []).map(e => e.source))].sort();
          if (uniqueSources.length > 0) setSources(uniqueSources);
          if (historyData.latest) setLatestPerSource(historyData.latest);
        }

        if (contentRes.ok) {
          const text = await contentRes.text();
          let meta: { useBase64: boolean; version?: string; source?: string } = { useBase64: true };
          try {
            if (metaRes.ok) meta = JSON.parse(await metaRes.text()) as { useBase64: boolean; version?: string; source?: string };
          } catch { /* ignore */ }
          const decoded = meta.useBase64 ? atob(text) : text;
          setContent(decoded);
          setSavedContent(decoded);
          setUseBase64(meta.useBase64);
          setSavedBase64(meta.useBase64);
          if (meta.source) { setSource(meta.source); setSavedSource(meta.source); }
          if (meta.version) { setVersion(meta.version); setSavedVersion(meta.version); }
        }
      } catch { /* ignore */ }
      finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const autoVersion = useMemo(() => {
    const latest = latestPerSource[source];
    return latest ? String(parseInt(latest, 10) + 1) : '';
  }, [source, latestPerSource]);

  useEffect(() => {
    if (!version && autoVersion) {
      setVersion(autoVersion);
      setSavedVersion(autoVersion);
    }
  }, [autoVersion]);

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

  const charCount = useMemo(() => content.length.toLocaleString(), [content]);
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
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.08 }}>
              Provider
            </Typography>
            <Select value={source} onChange={(e) => {
              if (e.target.value === '__add__') {
                setAddDialogOpen(true);
              } else {
                setSource(e.target.value);
              }
            }} size="small" sx={{ mt: 0.5, width: 160 }}>
              {sources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              <MenuItem value="__add__" sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 1, color: 'primary.main', fontWeight: 500 }}>
                ✚ Add a provider
              </MenuItem>
            </Select>
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.08 }}>
              Version
            </Typography>
            <TextField type="number" value={version} size="small" sx={{ mt: 0.5, width: 120 }}
              onChange={(e) => setVersion(e.target.value)} />
          </Box>
        </Box>
      </Card>

      {isLoading ? (
        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          {[288, 24, 24].map((h, i) => (
            <Box key={i} className="skeleton" sx={{ height: h, mb: 1 }} />
          ))}
        </Card>
      ) : showPreview ? (
        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <pre style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: 13,
            color: revealed ? undefined : 'text.secondary',
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            minHeight: 80,
            userSelect: revealed ? 'text' : 'none',
          }}>
            {revealed ? content : maskContent(content)}
          </pre>
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
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="keybox-textarea"
            rows={12}
            placeholder="Paste your keybox here…" 
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: '"Geist Mono", monospace', fontSize: 16, lineHeight: 1.5,
              color: 'inherit', background: 'transparent', border: 'none', outline: 'none', resize: 'vertical', padding: 0 }} />
        </Card>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">{charCount} characters</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {editing && <Button variant="text" onClick={handleCancelEdit}>Cancel</Button>}
          <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopy}>Copy</Button>
          <Button variant="contained" startIcon={<ContentPasteIcon />} onClick={handlePaste}>Paste</Button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch checked={useBase64} onChange={(e) => setUseBase64(e.target.checked)} size="small" />
            <Typography variant="body2" color="text.secondary">Base64</Typography>
          </label>
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
