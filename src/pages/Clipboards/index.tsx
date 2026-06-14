import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Clipboard as ClipboardIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import PageLayout from '../../components/PageLayout';
import EmptyState from '../../components/EmptyState';
import ClipboardList from './ClipboardList';
import ClipboardEditor from './ClipboardEditor';
import CreateDialog from './CreateDialog';
import DeleteDialog from './DeleteDialog';
import useClipboards from '../../hooks/useClipboards';
import { clipboardUrl } from '../../utils/clipboardUrl';

interface ClipboardsPageProps {
  token: string | null;
  role: string;
}

export default function ClipboardsPage({ token, role }: ClipboardsPageProps) {
  const { clipboards, selected, isLoading, fetchAll, select, create, update, remove } = useClipboards();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const hasRestored = useRef(false);

  useEffect(() => { if (token) fetchAll(token); }, [token, fetchAll]);

  useEffect(() => {
    if (clipboards.length > 0 && !hasRestored.current) {
      hasRestored.current = true;
      const storedId = localStorage.getItem('keybox:clipboardId');
      if (storedId && clipboards.some((c) => c.id === storedId)) select(storedId);
    }
  }, [clipboards, select]);

  useEffect(() => {
    if (selected) localStorage.setItem('keybox:clipboardId', selected.id);
    else localStorage.removeItem('keybox:clipboardId');
  }, [selected]);

  const handleSelect = useCallback((id: string) => {
    select(id);
  }, [select]);

  const handleCreate = useCallback(async (name: string, slug?: string, useShuffle?: boolean) => {
    if (!token) return;
    const id = await create(token, name, slug, undefined, useShuffle);
    if (id) {
      toast.success('Clipboard created');
      select(id);
    } else {
      toast.error('Failed to create clipboard');
    }
  }, [token, create, select]);

  const handleUpdate = useCallback(
    async (tok: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean; useShuffle?: boolean }): Promise<boolean> => {
      return update(tok, id, data);
    },
    [update]
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return;
    const ok = await remove(token, id);
    if (ok) {
      toast.success('Clipboard deleted');
      await fetchAll(token);
    } else {
      toast.error('Failed to delete clipboard');
    }
    setDeleteTarget(null);
  }, [token, remove, fetchAll]);

  const handleBatchDelete = useCallback(async (ids: string[]) => {
    if (!token) return;
    let ok = 0; let fail = 0;
    for (const id of ids) {
      const res = await remove(token, id);
      if (res) ok++; else fail++;
    }
    await fetchAll(token);
    toast(fail === 0 ? `Deleted ${ok} clipboard${ok !== 1 ? 's' : ''}` : `${ok} deleted, ${fail} failed`);
  }, [token, remove, fetchAll]);

  const handleCopyUrl = useCallback(async (id: string) => {
    const cb = clipboards.find((c) => c.id === id);
    const url = clipboardUrl(id, cb?.slug);
    try {
      await navigator.clipboard.writeText(url);
      toast('Raw URL copied');
    } catch { toast.error('Failed to copy'); }
  }, [clipboards]);

  const isEmpty = !isLoading && clipboards.length === 0;

  return (
    <PageLayout
      title="Clipboards"
      description="Freeform text storage with raw endpoints."
      count={clipboards.length}
      maxWidth="full"
      compact
      actions={
        role === 'admin' ? (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="size-4 mr-1" />
            New
          </Button>
        ) : undefined
      }
    >
      {isEmpty ? (
        <EmptyState
          icon={<ClipboardIcon className="size-16" />}
          title="No clipboards yet"
          description="Create one to start storing text with its own raw URL endpoint."
          action={role === 'admin' ? { label: 'Create your first clipboard', onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="flex flex-1 min-h-0">
          <ClipboardList
            clipboards={clipboards}
            selectedId={selected?.id ?? null}
            isLoading={isLoading}
            role={role}
            onSelect={handleSelect}
            onCopyUrl={handleCopyUrl}
            onDelete={(id) => {
              const cb = clipboards.find((c) => c.id === id);
              if (cb) setDeleteTarget({ id, name: cb.name });
            }}
            onBatchDelete={handleBatchDelete}
          />
          {selected && (
            <div className="hidden md:flex flex-col flex-1 min-w-0 border-l border-border">
              <ClipboardEditor
                clipboard={selected} token={token} role={role} onUpdate={handleUpdate}
              />
            </div>
          )}
        </div>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />
      <DeleteDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </PageLayout>
  );
}
