import type { RefObject } from 'react';

interface NavRailProps {
  navRef: RefObject<any>;
  userInitials: string;
  onSignOut: () => void;
  onNavigate: (page: string) => void;
  clipboardCount?: number;
  fileCount?: number;
}

export default function NavRail({ navRef, userInitials, onSignOut, onNavigate, clipboardCount, fileCount }: NavRailProps) {
  return (
    <mdui-navigation-rail ref={navRef} label-visibility="selected">
      <div slot="header" className="nav-header">
        <mdui-icon
          name="key"
          style={{
            fontSize: 22,
            color: 'var(--mdui-color-primary)',
            display: 'block',
          }}
        />
        <span className="nav-wordmark">keybox</span>
      </div>

      <mdui-navigation-rail-item
        icon="vpn_key--outlined"
        active-icon="vpn_key"
        value="keybox"
        onClick={() => onNavigate('keybox')}
      >
        Keybox
      </mdui-navigation-rail-item>

      <mdui-navigation-rail-item
        icon="content_paste--outlined"
        active-icon="content_paste"
        value="clipboards"
        onClick={() => onNavigate('clipboards')}
      >
        Boards
        {clipboardCount !== undefined && clipboardCount > 0 && (
          <mdui-badge slot="badge">{clipboardCount}</mdui-badge>
        )}
      </mdui-navigation-rail-item>

      <mdui-navigation-rail-item
        icon="folder--outlined"
        active-icon="folder"
        value="files"
        onClick={() => onNavigate('files')}
      >
        Files
        {fileCount !== undefined && fileCount > 0 && (
          <mdui-badge slot="badge">{fileCount}</mdui-badge>
        )}
      </mdui-navigation-rail-item>

      <mdui-navigation-rail-item
        icon="history--outlined"
        active-icon="history"
        value="history"
        onClick={() => onNavigate('history')}
      >
        History
      </mdui-navigation-rail-item>

      <div slot="bottom" className="nav-footer">
        <mdui-dropdown placement="right-end">
          <mdui-avatar
            slot="trigger"
            style={{ cursor: 'pointer', fontSize: '14px' }}
          >
            {userInitials}
          </mdui-avatar>
          <mdui-menu>
            <mdui-menu-item value="signout" icon="logout" onClick={onSignOut}>Sign out</mdui-menu-item>
          </mdui-menu>
        </mdui-dropdown>
        <span className="nav-status-dot" />
      </div>
    </mdui-navigation-rail>
  );
}
