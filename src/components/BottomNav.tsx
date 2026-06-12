import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import FolderIcon from "@mui/icons-material/Folder";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import ExtensionIcon from "@mui/icons-material/Extension";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import type { Page } from "../App";
import type { UserRole } from "../hooks/useAuth";

interface BottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  role: UserRole;
}

export default function BottomNav({ activePage, onNavigate, role }: BottomNavProps) {
  const allActions: Array<{ value: Page; label: string; icon: React.ReactNode }> = [
    { value: "keybox", label: "Keyboxes", icon: <KeyIcon /> },
    { value: "clipboards", label: "Boards", icon: <ContentPasteIcon /> },
    { value: "files", label: "Files", icon: <FolderIcon /> },
    { value: "apps", label: "Apps", icon: <PlaylistAddCheckIcon /> },
    { value: "modules", label: "Modules", icon: <ExtensionIcon /> },
    { value: "apks", label: "APKs", icon: <SmartphoneIcon /> },
  ];

  if (role === "admin") {
    allActions.push({ value: "roles", label: "Roles", icon: <AdminPanelSettingsIcon /> });
  }

  return (
    <Paper
      sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1200 }}
      elevation={3}
    >
      <BottomNavigation
        value={activePage}
        onChange={(_, value: Page) => onNavigate(value)}
        sx={{ bgcolor: "surfaceContainer.main" }}
      >
        {allActions.map((action) => (
          <BottomNavigationAction
            key={action.value}
            value={action.value}
            label={action.label}
            icon={action.icon}
            sx={{ color: "text.secondary", "&.Mui-selected": { color: "primary.main" } }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
