import { useEffect, useState, useCallback } from 'react';
import { Globe, Trash2, Send, ExternalLink, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import PageLayout from '../../components/PageLayout';
import EmptyState from '../../components/EmptyState';

interface Instance {
  slug: string;
  owner_email: string;
  display_name: string;
  created_at: string;
  user_count: number;
  setup_complete: boolean;
}

interface InstancesPageProps {
  token: string | null;
  role: string;
}

export default function InstancesPage({ token }: InstancesPageProps) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/instances', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { instances?: Instance[] };
        setInstances(data.instances ?? []);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteSlug) return;
    try {
      const res = await fetch(`/api/instances/${deleteSlug}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(`Deleted ${deleteSlug}`);
        setDeleteSlug(null);
        await fetchInstances();
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? 'Failed to delete');
      }
    } catch { toast.error('Failed to delete'); }
  }, [token, deleteSlug, fetchInstances]);

  const handleResend = useCallback(async (slug: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/instances/${slug}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(`Setup email resent to ${slug}`);
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? 'Failed to resend');
      }
    } catch { toast.error('Failed to resend'); }
  }, [token]);

  const domain = window.location.host.replace(/^[^.]+\./, '');

  return (
    <PageLayout
      title="Instances"
      count={`${instances.length} instance${instances.length !== 1 ? 's' : ''}`}
      maxWidth="sm"
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
        </div>
      ) : instances.length === 0 ? (
        <EmptyState
          icon={<Globe className="size-12" />}
          title="No instances yet"
          description="Create an instance from the Roles page to get started."
        />
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {instances.map((inst) => {
            const isMain = inst.slug === 'admin';
            return (
              <div key={inst.slug}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card hover:bg-accent border border-border transition-colors"
              >
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 shrink-0">
                  <Globe className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{inst.slug}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${inst.setup_complete ? 'text-green-500 bg-green-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
                      {inst.setup_complete ? 'Ready' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {inst.owner_email} &middot; {inst.user_count} user{inst.user_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isMain && (
                    <a
                      href={`https://${inst.slug}.${domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground p-1.5"
                      title="Visit instance"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  {!inst.setup_complete && (
                    <button
                      onClick={() => handleResend(inst.slug)}
                      className="text-muted-foreground hover:text-foreground p-1.5"
                      title="Resend setup email"
                    >
                      <Send className="size-4" />
                    </button>
                  )}
                  {!isMain && (
                    <button
                      onClick={() => setDeleteSlug(inst.slug)}
                      className="text-muted-foreground hover:text-destructive p-1.5"
                      title="Delete instance"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteSlug} onOpenChange={(o) => { if (!o) setDeleteSlug(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete Instance</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>{deleteSlug}</strong> and all its data.
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSlug(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
