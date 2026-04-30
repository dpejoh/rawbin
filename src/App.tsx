import { useState, useCallback, useMemo, useEffect } from 'react';
import { setTheme, setColorScheme } from 'mdui';
import { useMduiNav } from './hooks/useMdui';
import NavRail from './components/NavRail';
import Keybox from './pages/Keybox';
import ClipboardsPage from './pages/Clipboards';
import FilesPage from './pages/Files';
import useAuth from './hooks/useAuth';

export type Page = 'keybox' | 'clipboards' | 'files';

function getInitialPage(): Page {
  const stored = localStorage.getItem('keybox:page');
  if (stored === 'keybox' || stored === 'clipboards' || stored === 'files') return stored;
  return 'keybox';
}

export default function App() {
  const { user, token, isLoading, signOut, openLogin } = useAuth();
  const [page, setPage] = useState<Page>(getInitialPage);

  useEffect(() => {
    setTheme('dark');
    setColorScheme('#1B6EF3');
  }, []);

  useEffect(() => {
    localStorage.setItem('keybox:page', page);
  }, [page]);

  const handleNavigate = useCallback((p: string) => setPage(p as Page), []);

  const railRef = useMduiNav(page, handleNavigate);
  const barRef  = useMduiNav(page, handleNavigate);

  const userInitials = useMemo(
    () => (user?.email ? (user.email[0]?.toUpperCase() ?? '?') : '?'),
    [user],
  );

  if (isLoading) {
    return (
      <div className="auth-screen">
        <mdui-circular-progress />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <mdui-icon name="lock_open" style={{ fontSize: 48, color: 'var(--mdui-color-outline)' }} />
        <p className="mdui-typescale-headline-small" style={{ margin: 0 }}>
          Sign in to Keybox
        </p>
        <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
          Authenticate with your Netlify Identity account to continue.
        </p>
        <mdui-button variant="filled" onClick={openLogin}>Sign In</mdui-button>
      </div>
    );
  }

  return (
    <mdui-layout>
      <NavRail
        navRef={railRef}
        userInitials={userInitials}
        onSignOut={signOut}
        onNavigate={handleNavigate}
      />

      <mdui-layout-main>
        <div className="mobile-pb" style={{ flex: 1, overflow: 'auto' }}>
          {page === 'keybox'      && <Keybox token={token} />}
          {page === 'clipboards'  && <ClipboardsPage token={token} />}
          {page === 'files'       && <FilesPage token={token} />}
        </div>
      </mdui-layout-main>

      <mdui-navigation-bar ref={barRef} label-visibility="selected">
        <mdui-navigation-bar-item
          icon="vpn_key--outlined"
          active-icon="vpn_key"
          value="keybox"
          onClick={() => handleNavigate('keybox')}
        >
          Keybox
        </mdui-navigation-bar-item>
        <mdui-navigation-bar-item
          icon="content_paste--outlined"
          active-icon="content_paste"
          value="clipboards"
          onClick={() => handleNavigate('clipboards')}
        >
          Boards
        </mdui-navigation-bar-item>
        <mdui-navigation-bar-item
          icon="folder--outlined"
          active-icon="folder"
          value="files"
          onClick={() => handleNavigate('files')}
        >
          Files
        </mdui-navigation-bar-item>
      </mdui-navigation-bar>
    </mdui-layout>
  );
}
