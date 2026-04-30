import { useState, useCallback, useMemo } from "react";
import { ThemeProvider, CssBaseline, Box, useMediaQuery, CircularProgress, Stack } from "@mui/material";
import theme from "./theme/theme";
import NavRail from "./components/NavRail";
import type { Page } from "./components/NavRail";
import BottomNav from "./components/BottomNav";
import SnackbarProvider from "./components/SnackbarProvider";
import Keybox from "./pages/Keybox";
import ClipboardsPage from "./pages/Clipboards";
import useAuth from "./hooks/useAuth";

export default function App() {
  const isMobile = useMediaQuery("(max-width: 599px)");
  const { user, token, isLoading, signOut } = useAuth();
  const [page, setPage] = useState<Page>("keybox");

  const userInitials = useMemo(
    () => (user?.email ? user.email[0]?.toUpperCase() ?? "?" : "?"),
    [user]
  );

  const handleNavigate = useCallback((p: Page) => setPage(p), []);

  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ height: "100vh", bgcolor: "background.default" }}
        >
          <CircularProgress />
        </Stack>
      </ThemeProvider>
    );
  }

  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ height: "100vh", bgcolor: "background.default", gap: 2, px: 3 }}
        >
          {/* netlify-identity-widget will auto-show its modal */}
        </Stack>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <Box
          sx={{
            display: "flex",
            height: "100vh",
            bgcolor: "background.default",
            overflow: "hidden",
          }}
        >
          {isMobile ? (
            <BottomNav activePage={page} onNavigate={handleNavigate} />
          ) : (
            <NavRail
              activePage={page}
              onNavigate={handleNavigate}
              userInitials={userInitials}
              onSignOut={signOut}
            />
          )}

          <Box
            component="main"
            sx={{
              flex: 1,
              overflow: "auto",
              pb: isMobile ? 7 : 0,
            }}
          >
            {page === "keybox" && <Keybox token={token} />}
            {page === "clipboards" && <ClipboardsPage token={token} />}
          </Box>
        </Box>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
