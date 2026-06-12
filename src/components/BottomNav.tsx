import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import FolderIcon from "@mui/icons-material/Folder";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import ExtensionIcon from "@mui/icons-material/Extension";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import type { Page } from "../App";

interface BottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function BottomNav({ activePage, onNavigate }: BottomNavProps) {
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
        <BottomNavigationAction
          value="keybox"
          label="Keyboxes"
          icon={<KeyIcon />}
          sx={{ color: "text.secondary", "&.Mui-selected": { color: "primary.main" } }}
        />
        <BottomNavigationAction
          value="clipboards"
          label="Boards"
          icon={<ContentPasteIcon />}
          sx={{ color: "text.secondary", "&.Mui-selected": { color: "primary.main" } }}
        />
        <BottomNavigationAction
          value="files"
          label="Files"
          icon={<FolderIcon />}
          sx={{ color: "text.secondary", "&.Mui-selected": { color: "primary.main" } }}
        />
        <BottomNavigationAction
          value="apps"
          label="Apps"
          icon={<PlaylistAddCheckIcon />}
          sx={{ color: "text.secondary", "&.Mui-selected": { color: "primary.main" } }}
        />
        <BottomNavigationAction
          value="modules"
          label="Modules"
          icon={<ExtensionIcon />}
          sx={{ color: "text.secondary", "&.Mui-selected": { color: "primary.main" } }}
        />
        <BottomNavigationAction
          value="apks"
          label="APKs"
          icon={<SmartphoneIcon />}
          sx={{ color: "text.secondary", "&.Mui-selected": { color: "primary.main" } }}
        />
      </BottomNavigation>
    </Paper>
  );
}
