import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  useMediaQuery,
  CircularProgress,
  Stack,
  Button,
  Typography,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import theme from './theme/theme';
import NavRail from './components/NavRail';
import BottomNav from './components/BottomNav';
import SnackbarProvider from './components/SnackbarProvider';
import CommandPalette from './components/CommandPalette';
import Keybox from './pages/Keybox';
import ClipboardsPage from './pages/Clipboards';
import FilesPage from './pages/Files';
import KeyboxHistory from './pages/KeyboxHistory';
import useAuth from './hooks/useAuth';

export type Page = 'keybox' | 'clipboards' | 'files' | 'history';

function getInitialPage(): Page {
  const stored = localStorage.getItem('keybox:page');
  if (stored === 'keybox' || stored === 'clipboards' || stored === 'files' || stored === 'history') return stored;
  return 'keybox';
}

export default function App() {
  const isMobile = useMediaQuery('(max-width: 599px)');
  const { user, token, isLoading, signOut, openLogin } = useAuth();
  const [page, setPage] = useState<Page>(getInitialPage);

  useEffect(() => {
    localStorage.setItem('keybox:page', page);
  }, [page]);

  const handleNavigate = useCallback((p: string) => setPage(p as Page), []);

  const userInitials = useMemo(
    () => (user?.email ? (user.email[0]?.toUpperCase() ?? '?') : '?'),
    [user],
  );

  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Stack alignItems="center" justifyContent="center" sx={{ height: '100vh', bgcolor: 'background.default' }}>
          <CircularProgress />
        </Stack>
      </ThemeProvider>
    );
  }

  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Stack alignItems="center" justifyContent="center" sx={{ height: '100vh', bgcolor: 'background.default', gap: 2, px: 3 }}>
          <LockOpenIcon sx={{ fontSize: 48, color: 'outline.main' }} />
          <Typography variant="h5" sx={{ color: 'text.primary' }}>Sign in to Keybox</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Authenticate with your Netlify Identity account to continue.
          </Typography>
          <Button variant="contained" size="large" onClick={openLogin} sx={{ textTransform: 'none', mt: 1 }}>
            Sign In
          </Button>
        </Stack>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
          {isMobile ? (
            <BottomNav activePage={page} onNavigate={handleNavigate} />
          ) : (
            <NavRail activePage={page} onNavigate={handleNavigate} userInitials={userInitials} onSignOut={signOut} />
          )}

          <Box component="main" sx={{ flex: 1, overflow: 'auto', pb: isMobile ? 7 : 0 }}>
            {page === 'keybox' && <Keybox token={token} />}
            {page === 'clipboards' && <ClipboardsPage token={token} />}
            {page === 'files' && <FilesPage token={token} />}
            {page === 'history' && <KeyboxHistory token={token} />}
          </Box>
        </Box>

        {token && <CommandPalette token={token} onNavigate={handleNavigate} />}
      </SnackbarProvider>
    </ThemeProvider>
  );
}
