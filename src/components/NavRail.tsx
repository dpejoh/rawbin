import { useState } from 'react';
import {
  Stack,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DataObjectIcon from '@mui/icons-material/DataObject';
import KeyIcon from '@mui/icons-material/Key';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FolderIcon from '@mui/icons-material/Folder';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ExtensionIcon from '@mui/icons-material/Extension';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import type { Page } from '../App';
import type { UserRole } from '../hooks/useAuth';

interface NavRailProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  userInitials: string;
  onSignOut: () => void;
  role: UserRole;
}

export default function NavRail({
  activePage,
  onNavigate,
  userInitials,
  onSignOut,
  role,
}: NavRailProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const allNavItems: { id: Page; icon: React.ReactNode; label: string }[] = [
    { id: 'keybox', icon: <KeyIcon />, label: 'Keyboxes' },
    { id: 'clipboards', icon: <ContentPasteIcon />, label: 'Boards' },
    { id: 'files', icon: <FolderIcon />, label: 'Files' },
    { id: 'apps', icon: <PlaylistAddCheckIcon />, label: 'Apps' },
    { id: 'modules', icon: <ExtensionIcon />, label: 'Modules' },
    { id: 'apks', icon: <SmartphoneIcon />, label: 'APKs' },
  ];

  if (role === 'admin') {
    allNavItems.push({ id: 'roles', icon: <AdminPanelSettingsIcon />, label: 'Roles' });
  }

  return (
    <Stack
      sx={{
        width: 80,
        minWidth: 80,
        height: '100vh',
        bgcolor: 'surfaceContainer.main',
        alignItems: 'center',
        py: 2,
        justifyContent: 'space-between',
      }}
    >
      <Stack alignItems="center" spacing={0.5}>
        <DataObjectIcon sx={{ fontSize: 22, color: 'primary.main', mb: 0.5 }} />
        <Typography sx={{ fontSize: 10, color: 'text.secondary', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          rawbin
        </Typography>
      </Stack>

      <Stack spacing={0.5} alignItems="center">
        {allNavItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <IconButton
              key={item.id}
              onClick={() => onNavigate(item.id)}
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                bgcolor: isActive ? 'primary.main' : 'transparent',
                color: isActive ? '#0842A0' : 'text.secondary',
                '&:hover': { bgcolor: isActive ? 'primary.main' : 'action.hover' },
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              {item.icon}
              <Typography sx={{ fontSize: '11px', fontWeight: 500, lineHeight: 1, color: isActive ? '#0842A0' : 'text.secondary' }}>
                {item.label}
              </Typography>
            </IconButton>
          );
        })}
      </Stack>

      <Stack alignItems="center" spacing={0.5}>
        <Avatar
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: 36,
            height: 36,
            cursor: 'pointer',
            bgcolor: 'primary.main',
            color: '#0842A0',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {userInitials}
        </Avatar>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main', display: 'inline-block' }} />
      </Stack>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <MenuItem disabled sx={{ opacity: 0.7 }}>
          <ListItemText secondary={role} sx={{ textTransform: 'capitalize' }} />
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onSignOut(); }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Sign out</ListItemText>
        </MenuItem>
      </Menu>
    </Stack>
  );
}
