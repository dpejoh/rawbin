import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { snackbar } from 'mdui';
import { useIsMobile } from '../../hooks/useBreakpoint';
import ClipboardList from './ClipboardList';
import ClipboardEditor from './ClipboardEditor';
import CreateDialog from './CreateDialog';
import DeleteDialog from './DeleteDialog';
import useClipboards from '../../hooks/useClipboards';

interface ClipboardsPageProps {
  token: string | null;
}

function clipboardUrl(id: string, slug?: string): string {
  return `${window.location.origin}${slug ? `/clips/${slug}` : `/clips/${id}`}`;
}

export default function ClipboardsPage({ token }: ClipboardsPageProps) {
  const isMobile = useIsMobile();

  const {
    clipboards, selected, isLoading,
    fetchAll, select, create, update, remove,
  } = useClipboards();

  const [createOpen,        setCreateOpen]        = useState(false);
  const [deleteTarget,      setDeleteTarget]       = useState<{ id: string; name: string } | null>(null);
  const [mobileEditorOpen,  setMobileEditorOpen]   = useState(false);
  const hasRestored = useRef(false);

  useEffect(() => { if (token) fetchAll(token); }, [token, fetchAll]);

  useEffect(() => {
    if (clipboards.length > 0 && !hasRestored.current) {
      hasRestored.current = true;
      const storedId = localStorage.getItem('keybox:clipboardId');
      if (storedId && clipboards.some((c) => c.id === storedId)) {
        select(storedId);
      }
    }
  }, [clipboards, select]);

  useEffect(() => {
    if (selected) {
      localStorage.setItem('keybox:clipboardId', selected.id);
    } else {
      localStorage.removeItem('keybox:clipboardId');
    }
  }, [selected]);

  const handleSelect = useCallback((id: string) => {
    select(id);
    if (isMobile) setMobileEditorOpen(true);
  }, [select, isMobile]);

  const handleCreate = useCallback(async (name: string, slug?: string) => {
    if (!token) return;
    const id = await create(token, name, slug);
    if (id) {
      snackbar({ message: 'Clipboard created', placement: 'bottom', autoCloseDelay: 2500 });
      select(id);
      if (isMobile) setMobileEditorOpen(true);
    } else {
      snackbar({ message: 'Failed to create clipboard', placement: 'bottom', autoCloseDelay: 3000 });
    }
  }, [token, create, select, isMobile]);

  const handleUpdate = useCallback(
    async (tok: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean }) =>
      update(tok, id, data),
    [update],
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return;
    const ok = await remove(token, id);
    if (ok) {
      snackbar({ message: 'Clipboard deleted', placement: 'bottom', autoCloseDelay: 2500 });
      setMobileEditorOpen(false);
    } else {
      snackbar({ message: 'Failed to delete', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setDeleteTarget(null);
  }, [token, remove]);

  const handleCopyUrl = useCallback(async (id: string) => {
    const cb = clipboards.find(c => c.id === id);
    const url = clipboardUrl(id, cb?.slug);
    try {
      await navigator.clipboard.writeText(url);
      snackbar({ message: 'Raw URL copied', placement: 'bottom', autoCloseDelay: 2000 });
    } catch {
      snackbar({ message: 'Failed to copy', placement: 'bottom', autoCloseDelay: 2500 });
    }
  }, [clipboards]);

  const selectedWithContent = useMemo(() => {
    if (!selected) return null;
    return { ...selected, content: selected.content ?? '' };
  }, [selected]);

  if (isMobile && mobileEditorOpen && selectedWithContent) {
    return (
      <div className="mobile-pb" style={{ height: '100%', overflow: 'auto' }}>
        <mdui-button
          variant="text"
          icon="arrow_back"
          onClick={() => setMobileEditorOpen(false)}
          style={{ margin: 8 }}
        >
          Back
        </mdui-button>
        <ClipboardEditor
          clipboard={selectedWithContent}
          token={token}
          onUpdate={handleUpdate}
        />
      </div>
    );
  }

  const isEmpty = !isLoading && clipboards.length === 0;

  return (
    <div className={`page-fill${isMobile ? ' mobile-pb' : ''}`}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 24px 16px',
        }}
      >
        <div>
          <p className="mdui-typescale-headline-medium" style={{ margin: '0 0 2px' }}>
            Clipboards
          </p>
          <p
            className="mdui-typescale-body-medium"
            style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
          >
            Freeform text storage with raw endpoints.
          </p>
        </div>
        <mdui-button variant="tonal" icon="add" onClick={() => setCreateOpen(true)}>
          New Clipboard
        </mdui-button>
      </div>

      {isEmpty ? (
        <div className="empty-state">
          <mdui-icon
            name="content_paste"
            style={{ fontSize: 64, color: 'var(--mdui-color-outline)' }}
          />
          <p className="mdui-typescale-headline-small" style={{ margin: 0 }}>
            No clipboards yet
          </p>
          <p
            className="mdui-typescale-body-medium"
            style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
          >
            Create one to start storing text with its own raw URL endpoint.
          </p>
          <mdui-button variant="tonal" icon="add" onClick={() => setCreateOpen(true)}>
            Create your first clipboard
          </mdui-button>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ClipboardList
            clipboards={clipboards}
            selectedId={selected?.id ?? null}
            isLoading={isLoading}
            onSelect={handleSelect}
            onRename={(id) => { select(id); if (isMobile) setMobileEditorOpen(true); }}
            onCopyUrl={handleCopyUrl}
            onDelete={(id) => {
              const cb = clipboards.find(c => c.id === id);
              if (cb) setDeleteTarget({ id, name: cb.name });
            }}
          />
          {selectedWithContent && !isMobile && (
            <ClipboardEditor
              clipboard={selectedWithContent}
              token={token}
              onUpdate={handleUpdate}
            />
          )}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <DeleteDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </div>
  );
}
