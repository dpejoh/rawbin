import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
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
import GlobalFab from './components/GlobalFab';
import useAuth from './hooks/useAuth';

const KeyboxManager = lazy(() => import('./pages/KeyboxManager'));
const ClipboardsPage = lazy(() => import('./pages/Clipboards'));
const FilesPage = lazy(() => import('./pages/Files'));
const AppCatalog = lazy(() => import('./pages/AppCatalog'));
const ModulesPage = lazy(() => import('./pages/Modules'));
const APKsPage = lazy(() => import('./pages/APKs'));
const RolesPage = lazy(() => import('./pages/Roles'));

export type Page = 'keybox' | 'clipboards' | 'files' | 'apps' | 'modules' | 'apks' | 'roles';

function getInitialPage(): Page {
  const stored = localStorage.getItem('keybox:page');
  if (stored === 'keybox' || stored === 'clipboards' || stored === 'files' || stored === 'modules' || stored === 'apks' || stored === 'roles') return stored;
  return 'keybox';
}

export default function App() {
  const isMobile = useMediaQuery('(max-width: 599px)');
  const { user, token, role, isLoading, signOut, openLogin } = useAuth();
  const [page, setPage] = useState<Page>(getInitialPage);

  useEffect(() => {
    localStorage.setItem('keybox:page', page);
  }, [page]);

  const handleNavigate = useCallback((p: Page) => setPage(p), []);

  const userInitials = user?.email ? (user.email[0]?.toUpperCase() ?? '?') : '?';

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
          <Typography variant="h5" sx={{ color: 'text.primary' }}>Sign in to rawbin</Typography>
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
            <BottomNav activePage={page} onNavigate={handleNavigate} role={role} />
          ) : (
            <NavRail activePage={page} onNavigate={handleNavigate} userInitials={userInitials} onSignOut={signOut} role={role} />
          )}

          <Box component="main" sx={{ flex: 1, overflow: 'auto', pb: isMobile ? 7 : 0 }}>
            <Suspense fallback={<Stack alignItems="center" justifyContent="center" sx={{ p: 8 }}><CircularProgress /></Stack>}>
              {page === 'keybox' && <KeyboxManager token={token} role={role} />}
              {page === 'clipboards' && <ClipboardsPage token={token} role={role} />}
              {page === 'files' && <FilesPage token={token} role={role} />}
              {page === 'apps' && <AppCatalog token={token} role={role} />}
              {page === 'modules' && <ModulesPage token={token} role={role} />}
              {page === 'apks' && <APKsPage token={token} role={role} />}
              {page === 'roles' && <RolesPage token={token} role={role} />}
            </Suspense>
          </Box>
        </Box>

        {token && <CommandPalette token={token} onNavigate={handleNavigate} />}
        {token && <GlobalFab token={token} role={role} onNavigate={handleNavigate} />}
      </SnackbarProvider>
    </ThemeProvider>
  );
}
