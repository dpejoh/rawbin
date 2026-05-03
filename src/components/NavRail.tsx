import { useState, useCallback, useMemo } from 'react';
import {
  Stack,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Badge,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FolderIcon from '@mui/icons-material/Folder';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import type { Page } from '../App';

interface NavRailProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  userInitials: string;
  onSignOut: () => void;
  clipboardCount?: number;
  fileCount?: number;
}

const navItems: { id: Page; icon: React.ReactNode; label: string; count?: number }[] = [
  { id: 'keybox', icon: <KeyIcon />, label: 'Keybox' },
  { id: 'clipboards', icon: <ContentPasteIcon />, label: 'Boards' },
  { id: 'files', icon: <FolderIcon />, label: 'Files' },
  { id: 'history', icon: <HistoryIcon />, label: 'History' },
];

export default function NavRail({
  activePage,
  onNavigate,
  userInitials,
  onSignOut,
  clipboardCount,
  fileCount,
}: NavRailProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const items = useMemo(() => navItems.map(item => ({
    ...item,
    count: item.id === 'clipboards' ? clipboardCount : item.id === 'files' ? fileCount : undefined,
  })), [clipboardCount, fileCount]);

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
        <KeyIcon sx={{ fontSize: 22, color: 'primary.main', mb: 0.5 }} />
        <Typography sx={{ fontSize: 10, color: 'text.secondary', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          keybox
        </Typography>
      </Stack>

      <Stack spacing={0.5} alignItems="center">
        {items.map((item) => {
          const isActive = activePage === item.id;
          const btn = (
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
          if (item.count !== undefined && item.count > 0) {
            return (
              <Badge key={item.id} badgeContent={item.count} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16 } }}>
                {btn}
              </Badge>
            );
          }
          return btn;
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
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mdui-color-primary, #6DD58C)', display: 'inline-block' }} />
      </Stack>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { setAnchorEl(null); onSignOut(); }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Sign out</ListItemText>
        </MenuItem>
      </Menu>
    </Stack>
  );
}
