import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon as MenuItemIcon,
  Divider,
  Skeleton,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import LinkIcon from "@mui/icons-material/Link";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useCallback, useState } from "react";
import type { Clipboard } from "../../hooks/useClipboards";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface ClipboardListProps {
  clipboards: Clipboard[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onCopyUrl: (id: string) => void;
  onDelete: (id: string) => void;
}

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
  const [menuClipboardId, setMenuClipboardId] = useState<string | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>, id: string) => {
      e.stopPropagation();
      setMenuAnchor(e.currentTarget);
      setMenuClipboardId(id);
    },
    []
  );

  const handleMenuAction = useCallback(
    (action: (id: string) => void) => {
      if (menuClipboardId) action(menuClipboardId);
      setMenuAnchor(null);
      setMenuClipboardId(null);
    },
    [menuClipboardId]
  );

  if (isLoading) {
    return (
      <List sx={{ width: 320, minWidth: 320, bgcolor: "surfaceContainer.main", height: "100%", overflow: "auto" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={64} sx={{ m: 1, borderRadius: 1 }} />
        ))}
      </List>
    );
  }

  return (
    <>
      <List
        sx={{
          width: 320,
          minWidth: 320,
          bgcolor: "surfaceContainer.main",
          height: "100%",
          overflow: "auto",
          p: 0,
        }}
      >
        {clipboards.map((cb) => (
          <ListItemButton
            key={cb.id}
            selected={cb.id === selectedId}
            onClick={() => onSelect(cb.id)}
            sx={{
              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "#0842A0",
                "& .MuiListItemIcon-root": { color: "#0842A0" },
                "& .MuiListItemText-secondary": { color: "#0842A0" },
              },
              "&:hover": { bgcolor: "surfaceContainerHigh.main" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <DescriptionIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary={cb.name}
              primaryTypographyProps={{
                variant: "subtitle1",
                noWrap: true,
                sx: { color: "inherit" },
              }}
              secondary={`${relativeTime(cb.updatedAt)} · ${cb.content.length.toLocaleString()} chars`}
              secondaryTypographyProps={{
                variant: "caption",
                sx: { color: "text.secondary" },
              }}
            />
            <IconButton
              size="small"
              onClick={(e) => handleContextMenu(e, cb.id)}
              sx={{ color: "text.secondary" }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
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
        <MenuItem onClick={() => handleMenuAction(onDelete)} sx={{ color: "error.main" }}>
          <MenuItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: "error.main" }} /></MenuItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}
