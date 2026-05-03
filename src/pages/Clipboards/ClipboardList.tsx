import { useMemo, useState, useCallback } from 'react';
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon as MenuItemIcon,
  Divider,
  Chip,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import LinkIcon from '@mui/icons-material/Link';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { relativeTime } from '../../utils/time';
import { detectContentType } from '../../utils/detectType';
import type { Clipboard } from '../../hooks/useClipboards';

interface ClipboardListProps {
  clipboards: Clipboard[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onCopyUrl: (id: string) => void;
  onDelete: (id: string) => void;
}

const typeChipColor: Record<string, 'primary' | 'secondary' | 'success' | 'default'> = {
  json: 'primary',
  xml: 'secondary',
  pem: 'success',
  yaml: 'primary',
  toml: 'secondary',
  text: 'default',
  empty: 'default',
  base64: 'default',
};

export default function ClipboardList({
  clipboards,
  selectedId,
  isLoading,
  onSelect,
  onRename,
  onCopyUrl,
  onDelete,
}: ClipboardListProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const typeInfoMap = useMemo(() => {
    const map: Record<string, { type: string; label: string }> = {};
    for (const cb of clipboards) {
      const info = detectContentType(cb.content ?? '');
      map[cb.id] = info;
    }
    return map;
  }, [clipboards]);

  const handleMenuOpen = useCallback((e: React.MouseEvent<HTMLElement>, id: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuId(id);
  }, []);

  const handleMenuAction = useCallback((action: (id: string) => void) => {
    if (menuId) action(menuId);
    setMenuAnchor(null);
    setMenuId(null);
  }, [menuId]);

  if (isLoading) {
    return (
      <div className="clipboard-panel" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 64 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="clipboard-panel">
      <List sx={{ p: 0 }}>
        {clipboards.map((cb) => {
          const isActive = cb.id === selectedId;
          const typeInfo = typeInfoMap[cb.id];
          return (
            <ListItemButton
              key={cb.id}
              selected={isActive}
              onClick={() => onSelect(cb.id)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: '#0842A0',
                  '& .MuiListItemIcon-root': { color: '#0842A0' },
                  '& .MuiListItemText-secondary': { color: '#0842A0' },
                },
                '&:hover': { bgcolor: 'surfaceContainerHigh.main' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <DescriptionIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={cb.name}
                primaryTypographyProps={{ variant: 'subtitle1', noWrap: true, sx: { color: 'inherit' } }}
                secondary={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {relativeTime(cb.updatedAt)} · {cb.content.length.toLocaleString()} chars
                    {typeInfo && typeInfo.type !== 'text' && typeInfo.type !== 'empty' && (
                      <Chip
                        label={typeInfo.label}
                        size="small"
                        color={typeChipColor[typeInfo.type] ?? 'default'}
                        sx={{ height: 18, fontSize: 10 }}
                      />
                    )}
                  </span>
                }
                secondaryTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
              />
              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, cb.id)}
                sx={{ color: 'text.secondary' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          );
        })}
      </List>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleMenuAction(onRename)}>
          <MenuItemIcon><DriveFileRenameOutlineIcon fontSize="small" /></MenuItemIcon>
          Rename
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction(onCopyUrl)}>
          <MenuItemIcon><LinkIcon fontSize="small" /></MenuItemIcon>
          Copy raw URL
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleMenuAction(onDelete)} sx={{ color: 'error.main' }}>
          <MenuItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} /></MenuItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </div>
  );
}
