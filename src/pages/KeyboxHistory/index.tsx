import { useEffect, useState, useCallback, useRef } from 'react';
import { snackbar } from 'mdui';
import RawUrlRow from '../../components/RawUrlRow';

interface HistoryEntry {
  version: string;
  serial: string;
  timestamp: string;
}

interface KeyboxHistoryProps {
  token: string | null;
}

export default function KeyboxHistory({ token }: KeyboxHistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/.netlify/functions/history');
      if (res.ok) {
        const data = await res.json() as HistoryEntry[];
        setEntries(data.sort((a, b) => {
          const na = parseInt(a.version, 10);
          const nb = parseInt(b.version, 10);
          if (!isNaN(na) && !isNaN(nb)) return nb - na;
          return b.timestamp.localeCompare(a.timestamp);
        }));
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !token) return;

    setIsImporting(true);
    const importData: Array<{ version: string; content: string }> = [];

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            importData.push(...parsed);
          } else if (parsed.version && parsed.content) {
            importData.push(parsed);
          }
        } else {
          const versionMatch = file.name.match(/(\d+)/);
          const fromName = versionMatch ? versionMatch[1] : '';
          let version = '';
          if (fromName) {
            version = fromName;
          }
          if (!version) {
            version = String(Date.now());
          }
          importData.push({ version, content: text });
        }
      } catch { /* skip unreadable files */ }
    }

    if (importData.length === 0) {
      snackbar({ message: 'No valid keyboxes found in selection', placement: 'bottom', autoCloseDelay: 3000 });
      setIsImporting(false);
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(importData),
      });
      if (res.ok) {
        const result = await res.json() as { imported: number; results: Array<{ version: string; status: string }> };
        const ok = result.results.filter(r => r.status === 'ok').length;
        const skipped = result.results.filter(r => r.status !== 'ok').length;
        snackbar({
          message: `Imported ${ok} keybox${ok !== 1 ? 'es' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`,
          placement: 'bottom',
          autoCloseDelay: 3000,
        });
        await fetchHistory();
      } else {
        snackbar({ message: 'Import failed', placement: 'bottom', autoCloseDelay: 3000 });
      }
    } catch {
      snackbar({ message: 'Import failed', placement: 'bottom', autoCloseDelay: 3000 });
    } finally {
      setIsImporting(false);
    }
  }, [token, fetchHistory]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    dragCounter.current = 0;
    handleImport(e.dataTransfer.files);
  }, [handleImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback(() => {
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const filtered = searchQuery.trim()
    ? entries.filter(e =>
        e.version.includes(searchQuery.trim()) ||
        e.serial.includes(searchQuery.trim())
      )
    : entries;

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="page page-fill" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p className="mdui-typescale-headline-medium" style={{ margin: '0 0 4px' }}>
            Keybox History
          </p>
          <p
            className="mdui-typescale-body-medium"
            style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
          >
            All known Yuri keyboxes — {entries.length} version{entries.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div
        className={`upload-dropzone ${dragging ? 'upload-dropzone--active' : ''}`}
        style={{ marginBottom: 16, position: 'relative' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <mdui-icon name="file_upload" style={{ fontSize: 32, color: 'var(--mdui-color-on-surface-variant)' }} />
        <p className="mdui-typescale-body-medium" style={{ margin: 0 }}>
          {isImporting ? 'Importing...' : 'Drop XML or JSON files here, or click to browse'}
        </p>
        <p className="mdui-typescale-body-small" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
          JSON format: [{'{'} "version": "1", "content": "&lt;xml&gt;..." {'}'}]
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.json"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleImport(e.target.files)}
        />
        {isImporting && (
          <mdui-circular-progress style={{ marginTop: 8 }} />
        )}
      </div>

      <mdui-text-field
        variant="filled"
        placeholder="Search by version or serial..."
        icon="search--outlined"
        value={searchQuery}
        style={{ width: '100%', marginBottom: 16 }}
        onInput={(e: any) => setSearchQuery(e.target.value)}
      >
        {searchQuery && (
          <mdui-button-icon
            slot="trailing-icon"
            icon="close"
            style={{ cursor: 'pointer' }}
            onClick={() => setSearchQuery('')}
          />
        )}
      </mdui-text-field>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <mdui-icon name="history" style={{ fontSize: 48, color: 'var(--mdui-color-outline)' }} />
          <p className="mdui-typescale-title-medium" style={{ margin: 0 }}>
            {searchQuery ? 'No matching versions' : 'No history yet'}
          </p>
          <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
            {searchQuery ? 'Try a different search term' : 'Import keyboxes to build the history'}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(entry => (
            <div
              key={entry.version}
              className="history-entry"
              onClick={() => setSelectedEntry(selectedEntry?.version === entry.version ? null : entry)}
            >
              <div className="history-entry-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="history-entry-version">
                    <span className="history-entry-version-label">v</span>
                    <span className="history-entry-version-num">{entry.version}</span>
                  </div>
                  <div>
                    <div className="history-entry-serial">
                      <mdui-icon name="fingerprint" style={{ fontSize: 14, opacity: 0.5 }} />
                      <span>{entry.serial}</span>
                    </div>
                    <span className="history-entry-time">{formatDate(entry.timestamp)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <mdui-chip icon="gpp_bad" style={{ '--mdui-color-primary': 'var(--mdui-color-error)' } as any}>
                    Revoked
                  </mdui-chip>
                  <mdui-icon
                    name={selectedEntry?.version === entry.version ? 'expand_less' : 'expand_more'}
                    style={{ color: 'var(--mdui-color-on-surface-variant)' }}
                  />
                </div>
              </div>
              {selectedEntry?.version === entry.version && (
                <div className="history-entry-details">
                  <div className="history-entry-detail-row">
                    <span className="history-entry-detail-label">Version</span>
                    <span>{entry.version}</span>
                  </div>
                  <div className="history-entry-detail-row">
                    <span className="history-entry-detail-label">Serial</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, wordBreak: 'break-all' }}>{entry.serial}</span>
                  </div>
                  <div className="history-entry-detail-row">
                    <span className="history-entry-detail-label">Date</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="history-entry-detail-row">
                    <span className="history-entry-detail-label">Status</span>
                    <mdui-chip icon="gpp_bad" style={{ '--mdui-color-primary': 'var(--mdui-color-error)' } as any}>
                      Revoked
                    </mdui-chip>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <RawUrlRow url={`${window.location.origin}/key/${entry.version}`} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
