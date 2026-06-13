import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import NavRail from './components/NavRail';
import BottomNav from './components/BottomNav';
import CommandPalette from './components/CommandPalette';
import GlobalFab from './components/GlobalFab';
import BackToTop from './components/BackToTop';
import AuthGate from './components/AuthGate';
import useAuth from './hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

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

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const { user, token, role, isLoading, signOut } = auth;
  const [page, setPage] = useState<Page>(getInitialPage);

  useEffect(() => {
    localStorage.setItem('keybox:page', page);
  }, [page]);

  const handleNavigate = useCallback((p: Page) => setPage(p), []);

  const userInitials = user?.email ? (user.email[0]?.toUpperCase() ?? '?') : '?';

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthGate {...auth} />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="hidden sm:flex">
        <NavRail activePage={page} onNavigate={handleNavigate} userInitials={userInitials} onSignOut={signOut} role={role} />
      </div>
      <div className="sm:hidden">
        <BottomNav activePage={page} onNavigate={handleNavigate} role={role} />
      </div>

      <main className="flex-1 overflow-auto pb-16 sm:pb-0">
        <Suspense fallback={<PageLoader />}>
          {page === 'keybox' && <KeyboxManager token={token} role={role} />}
          {page === 'clipboards' && <ClipboardsPage token={token} role={role} />}
          {page === 'files' && <FilesPage token={token} role={role} />}
          {page === 'apps' && <AppCatalog token={token} role={role} />}
          {page === 'modules' && <ModulesPage token={token} role={role} />}
          {page === 'apks' && <APKsPage token={token} role={role} />}
          {page === 'roles' && <RolesPage token={token} role={role} />}
        </Suspense>
      </main>

      <Toaster
        position="bottom-center"
        richColors
        closeButton
      />

      <BackToTop />
      {token && <CommandPalette token={token} onNavigate={handleNavigate} />}
      {token && <GlobalFab token={token} role={role} onNavigate={handleNavigate} />}
    </div>
  );
}
