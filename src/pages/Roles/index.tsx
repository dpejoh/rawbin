import { useEffect, useState, useCallback } from 'react';
import { Trash2, UserPlus, Shield, UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import PageLayout from '../../components/PageLayout';
import EmptyState from '../../components/EmptyState';

interface RolesPageProps {
  token: string | null;
  role: string;
}

export default function RolesPage({ token }: RolesPageProps) {
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('editor');
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRoles = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { roles?: Record<string, string> };
        setRoles(data.roles ?? {});
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleAdd = useCallback(async () => {
    if (!token || !newEmail.trim()) return;
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });
      if (res.ok) {
        toast.success(`Role set for ${newEmail.trim()}`);
        setAddOpen(false);
        setNewEmail('');
        await fetchRoles();
      } else {
        toast.error('Failed to set role');
      }
    } catch { toast.error('Failed to set role'); }
  }, [token, newEmail, newRole, fetchRoles]);

  const handleDelete = useCallback(async (email: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        toast.success(`Removed ${email}`);
        await fetchRoles();
      } else {
        toast.error('Failed to remove');
      }
    } catch { toast.error('Failed to remove'); }
  }, [token, fetchRoles]);

  const handleCreate = useCallback(async () => {
    if (!token || !createEmail.trim() || !createPassword || !createSlug.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: createEmail.trim(), password: createPassword, instance_slug: createSlug.trim() }),
      });
      if (res.ok) {
        toast.success(`Instance created for ${createEmail.trim()} → ${createSlug.trim()}.rawbin.dpejoh.com`);
        setCreateOpen(false);
        setCreateEmail('');
        setCreatePassword('');
        setCreateSlug('');
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? 'Failed to create account');
      }
    } catch { toast.error('Failed to create account'); }
    finally { setCreating(false); }
  }, [token, createEmail, createPassword, createSlug]);

  const entries = Object.entries(roles).sort(([a], [b]) => a.localeCompare(b));

  return (
    <PageLayout title="User Roles" count={`${Object.keys(roles).length} user${Object.keys(roles).length !== 1 ? 's' : ''}`} maxWidth="sm"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <UserRoundPlus className="size-4 mr-1" />
            Create Instance
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4 mr-1" />
            Add User
          </Button>
        </div>
      }
    >

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Shield className="size-12" />}
          title="No custom roles yet"
          description="Unlisted users default to viewer. Add users here to grant editor or admin access."
        />
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {entries.map(([email, r]) => {
            const roleColor = r === 'admin' ? 'text-amber-500 bg-amber-500/10' : r === 'editor' ? 'text-blue-400 bg-blue-400/10' : 'text-muted-foreground bg-muted';
            return (
              <div key={email}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card hover:bg-accent border border-border transition-colors"
              >
                <Shield className="size-6 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono">{email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize shrink-0 ${roleColor}`}>{r}</span>
                <button onClick={() => handleDelete(email)} className="text-muted-foreground hover:text-destructive p-1 shrink-0" title="Remove user" aria-label="Remove user">
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Add User Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newEmail.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Create Instance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Instance Slug</Label>
              <Input
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="e.g. yuri"
              />
              <p className="text-xs text-muted-foreground">
                They'll log in at {createSlug || '...'}.rawbin.dpejoh.com
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createEmail.trim() || !createPassword || !createSlug.trim() || creating}>
              {creating ? 'Creating...' : 'Create Instance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
