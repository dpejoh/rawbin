import { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Checkbox,
  Button,
  Menu,
  MenuItem,
  ListItemIcon as MenuItemIcon,
  Divider,
  Chip,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LinkIcon from '@mui/icons-material/Link';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { relativeTime } from '../../utils/time';
import { detectContentType } from '../../utils/detectType';
import type { Clipboard } from '../../hooks/useClipboards';

interface ClipboardListProps {
  clipboards: Clipboard[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onCopyUrl: (id: string) => void;
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
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
  onCopyUrl,
  onDelete,
  onBatchDelete,
}: ClipboardListProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

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

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size > 0 && onBatchDelete) {
      onBatchDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [selectedIds, onBatchDelete]);

  if (isLoading) {
    return (
      <Stack sx={{ width: 320, minWidth: 320, bgcolor: 'surfaceContainer.main', height: '100%', overflowY: 'auto', flexShrink: 0, p: 1, gap: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} className="skeleton" sx={{ height: 64 }} />
        ))}
      </Stack>
    );
  }

  return (
    <Box sx={{ width: 320, minWidth: 320, bgcolor: 'surfaceContainer.main', height: '100%', overflowY: 'auto', flexShrink: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: 'outlineVariant.main' }}>
        <Chip
          label={selectMode ? `${selectedIds.size} selected` : 'Select'}
          size="small"
          variant={selectMode ? 'filled' : 'outlined'}
          color={selectMode ? 'primary' : 'default'}
          onClick={() => {
            if (selectMode) {
              setSelectMode(false);
              setSelectedIds(new Set());
            } else {
              setSelectMode(true);
            }
          }}
          sx={{ cursor: 'pointer' }}
        />
        {selectMode && (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            sx={{ textTransform: 'none', minWidth: 'auto', fontSize: 12, mr: 1, height: 24, lineHeight: '16px' }}
          >
            Cancel
          </Button>
        )}
        {selectMode && (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              if (selectedIds.size === clipboards.length) setSelectedIds(new Set());
              else setSelectedIds(new Set(clipboards.map(c => c.id)));
            }}
            sx={{ textTransform: 'none', minWidth: 'auto', fontSize: 12 }}
          >
            {selectedIds.size === clipboards.length ? 'Deselect All' : 'Select All'}
          </Button>
        )}
        {selectMode && selectedIds.size > 0 && (
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteSweepIcon />}
            onClick={handleBatchDelete}
            sx={{ textTransform: 'none', minWidth: 'auto', fontSize: 12, height: 24 }}
          >
            Delete ({selectedIds.size})
          </Button>
        )}
      </Stack>
      {clipboards.map((cb) => {
        const isActive = cb.id === selectedId;
        const isSelected = selectedIds.has(cb.id);
        const typeInfo = typeInfoMap[cb.id];
        return (
          <Box
            key={cb.id}
            onClick={() => { if (!isSelected) onSelect(cb.id); }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 1,
              cursor: 'pointer',
              bgcolor: isActive
                ? '#1A3C6E'
                : isSelected
                  ? 'rgba(168,199,250,0.12)'
                  : 'transparent',
              borderBottom: 1,
              borderColor: 'outlineVariant.main',
              transition: 'background 150ms',
              '&:hover': {
                bgcolor: 'surfaceContainerHigh.main',
              },
            }}
          >
            <Box sx={{ width: 36, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
              {selectMode && (
                <Checkbox
                  checked={isSelected}
                  onChange={() => handleToggleSelect(cb.id)}
                  size="small"
                  sx={{ p: 0.5 }}
                />
              )}
            </Box>
            <DescriptionIcon sx={{ fontSize: 20, color: 'text.secondary', flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap sx={{ color: isActive ? '#fff' : 'text.primary' }}>
                {cb.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>
                  {relativeTime(cb.updatedAt)} · {cb.content.length.toLocaleString()} chars
                </Typography>
                {typeInfo && typeInfo.type !== 'text' && typeInfo.type !== 'empty' && (
                  <Chip label={typeInfo.label} size="small"
                    color={typeChipColor[typeInfo.type] ?? 'default'}
                    sx={{ height: 18, fontSize: 10 }}
                  />
                )}
              </Box>
            </Box>
            <IconButton size="small" onClick={(e) => handleMenuOpen(e, cb.id)} sx={{ color: 'text.secondary' }}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
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
    </Box>
  );
}
