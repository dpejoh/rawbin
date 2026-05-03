import {
  Stack,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import FolderIcon from "@mui/icons-material/Folder";
import LogoutIcon from "@mui/icons-material/Logout";
import { useCallback, useMemo, useState } from "react";

export type Page = "keybox" | "clipboards" | "files";

interface NavRailProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  userInitials: string;
  onSignOut: () => void;
}

export default function NavRail({
  activePage,
  onNavigate,
  userInitials,
  onSignOut,
}: NavRailProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleAvatarClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget),
    []
  );
  const handleMenuClose = useCallback(() => setAnchorEl(null), []);

  const navItems = useMemo(
    () => [
      { id: "keybox" as const, icon: <KeyIcon />, label: "Keybox" },
      { id: "clipboards" as const, icon: <ContentPasteIcon />, label: "Boards" },
      { id: "files" as const, icon: <FolderIcon />, label: "Files" },
    ],
    []
  );

  return (
    <Stack
      sx={{
        width: 80,
        minWidth: 80,
        height: "100vh",
        bgcolor: "surfaceContainer.main",
        alignItems: "center",
        py: 2,
        justifyContent: "space-between",
      }}
    >
      <Stack alignItems="center" spacing={3}>
        <KeyIcon
          sx={{ fontSize: 28, color: "primary.main", mb: 1 }}
        />
        <Stack spacing={0.5} alignItems="center">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <IconButton
                key={item.id}
                onClick={() => onNavigate(item.id)}
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: isActive ? "primary.main" : "transparent",
                  color: isActive ? "#0842A0" : "text.secondary",
                  "&:hover": {
                    bgcolor: isActive ? "primary.main" : "action.hover",
                  },
                  flexDirection: "column",
                  gap: 0.5,
                }}
              >
                {item.icon}
                <Typography
                  sx={{
                    fontSize: "11px",
                    fontWeight: 500,
                    lineHeight: 1,
                    color: isActive ? "#0842A0" : "text.secondary",
                  }}
                >
                  {item.label}
                </Typography>
              </IconButton>
            );
          })}
        </Stack>
      </Stack>

      <Avatar
        onClick={handleAvatarClick}
        sx={{
          width: 36,
          height: 36,
          cursor: "pointer",
          bgcolor: "primary.main",
          color: "#0842A0",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        {userInitials}
      </Avatar>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onSignOut();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sign out</ListItemText>
        </MenuItem>
      </Menu>
    </Stack>
  );
}
