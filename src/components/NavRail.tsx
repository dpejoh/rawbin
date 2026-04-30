import { useRef, useEffect } from 'react';
import type { RefObject } from 'react';

interface NavRailProps {
  navRef: RefObject<any>;
  userInitials: string;
  onSignOut: () => void;
}

export default function NavRail({ navRef, userInitials, onSignOut }: NavRailProps) {
  const menuRef = useRef<any>(null);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const handler = () => onSignOut();
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onSignOut]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <mdui-navigation-rail
        ref={navRef}
        label-visibility="selected"
        style={{ flex: 1 }}
      >
        <mdui-icon
          slot="header"
          name="key"
          style={{
            fontSize: 28,
            color: 'var(--mdui-color-primary)',
            padding: '12px 0 20px',
            display: 'block',
            textAlign: 'center',
          }}
        />

        <mdui-navigation-rail-item
          icon="vpn_key--outlined"
          active-icon="vpn_key"
          value="keybox"
        >
          Keybox
        </mdui-navigation-rail-item>

        <mdui-navigation-rail-item
          icon="content_paste--outlined"
          active-icon="content_paste"
          value="clipboards"
        >
          Boards
        </mdui-navigation-rail-item>

        <mdui-navigation-rail-item
          icon="folder--outlined"
          active-icon="folder"
          value="files"
        >
          Files
        </mdui-navigation-rail-item>
      </mdui-navigation-rail>

      <div className="nav-footer">
        <mdui-dropdown placement="right-end">
          <mdui-avatar
            slot="trigger"
            style={{ cursor: 'pointer', fontSize: '14px' }}
          >
            {userInitials}
          </mdui-avatar>
          <mdui-menu ref={menuRef}>
            <mdui-menu-item value="signout" icon="logout">Sign out</mdui-menu-item>
          </mdui-menu>
        </mdui-dropdown>
      </div>
    </div>
  );
}
