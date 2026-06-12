import { useEffect, useState, useCallback } from 'react';
import {
  Typography, TextField, Button, IconButton, Box, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useSnackbar } from 'notistack';

interface RolesPageProps {
  token: string | null;
  role: string;
}

export default function RolesPage({ token }: RolesPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('editor');

  const fetchRoles = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/.netlify/functions/roles', {
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
      const res = await fetch('/.netlify/functions/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });
      if (res.ok) {
        enqueueSnackbar(`Role set for ${newEmail.trim()}`, { variant: 'success' });
        setAddOpen(false);
        setNewEmail('');
        await fetchRoles();
      } else {
        enqueueSnackbar('Failed to set role', { variant: 'error' });
      }
    } catch { enqueueSnackbar('Failed to set role', { variant: 'error' }); }
  }, [token, newEmail, newRole, fetchRoles, enqueueSnackbar]);

  const handleDelete = useCallback(async (email: string) => {
    if (!token) return;
    try {
      const res = await fetch('/.netlify/functions/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        enqueueSnackbar(`Removed ${email}`, { variant: 'success' });
        await fetchRoles();
      } else {
        enqueueSnackbar('Failed to remove', { variant: 'error' });
      }
    } catch { enqueueSnackbar('Failed to remove', { variant: 'error' }); }
  }, [token, fetchRoles, enqueueSnackbar]);

  const entries = Object.entries(roles).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Box sx={{ p: 4, maxWidth: 600, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>User Roles</Typography>
          <Typography variant="body2" color="text.secondary">
            {Object.keys(roles).length} user{Object.keys(roles).length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ textTransform: 'none' }}>
          Add User
        </Button>
      </Stack>

      {isLoading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map(i => <Box key={i} className="skeleton" sx={{ height: 52, borderRadius: '8px' }} />)}
        </Stack>
      ) : entries.length === 0 ? (
        <Box className="empty-state" sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', p: '64px 24px', textAlign: 'center' }}>
          <AdminPanelSettingsIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6">No custom roles yet</Typography>
          <Typography variant="body2" color="text.secondary">
            Unlisted users default to viewer. Add users here to grant editor or admin access.
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                <TableCell align="right" sx={{ width: 60 }}>Remove</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(([email, role]) => (
                <TableRow key={email} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell sx={{ fontFamily: '"Geist Mono", monospace', fontSize: 13 }}>{email}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{role}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleDelete(email)} color="error" title="Remove role">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add User Role</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField autoFocus label="Email" fullWidth placeholder="user@example.com"
              value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              inputProps={{ spellCheck: false, fontFamily: '"Geist Mono", monospace' }}
            />
            <Select value={newRole} onChange={(e) => setNewRole(e.target.value)} size="small" fullWidth>
              <MenuItem value="viewer">Viewer</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!newEmail.trim()}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
