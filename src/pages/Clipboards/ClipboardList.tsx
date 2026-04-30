import { useCallback, useState } from 'react';
import { relativeTime } from '../../utils/time';
import type { Clipboard } from '../../hooks/useClipboards';

interface ClipboardListProps {
  clipboards: Clipboard[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onCopyUrl: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ClipboardList({
  clipboards,
  selectedId,
  isLoading,
  onSelect,
  onRename,
  onCopyUrl,
  onDelete,
}: ClipboardListProps) {
  if (isLoading) {
    return (
      <div className="clipboard-panel" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mdui-skeleton
            key={i}
            style={{
              height: 64,
              borderRadius: 'var(--mdui-shape-corner-small)',
              display: 'block',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="clipboard-panel">
      <mdui-list>
        {clipboards.map((cb) => {
          const isActive = cb.id === selectedId;
          return (
            <mdui-list-item
              key={cb.id}
              icon="description"
              rounded
              onClick={() => onSelect(cb.id)}
              style={
                isActive
                  ? {
                      background: 'var(--mdui-color-primary-container)',
                      color: 'var(--mdui-color-on-primary-container)',
                    }
                  : undefined
              }
            >
              {cb.name}
              <span slot="description">
                {relativeTime(cb.updatedAt)} · {cb.content.length.toLocaleString()} chars
              </span>

              <div slot="end-icon" onClick={(e) => e.stopPropagation()}>
                <mdui-dropdown trigger="click" placement="bottom-end">
                  <mdui-button-icon
                    slot="trigger"
                    icon="more_vert"
                    style={{ color: 'var(--mdui-color-on-surface-variant)' }}
                  />
                  <mdui-menu>
                    <mdui-menu-item
                      icon="drive_file_rename_outline"
                      onClick={() => onRename(cb.id)}
                    >
                      Rename
                    </mdui-menu-item>
                    <mdui-menu-item
                      icon="link"
                      onClick={() => onCopyUrl(cb.id)}
                    >
                      Copy raw URL
                    </mdui-menu-item>
                    <mdui-divider />
                    <mdui-menu-item
                      icon="delete_outline"
                      onClick={() => onDelete(cb.id)}
                      style={{ color: 'var(--mdui-color-error)' }}
                    >
                      Delete
                    </mdui-menu-item>
                  </mdui-menu>
                </mdui-dropdown>
              </div>
            </mdui-list-item>
          );
        })}
      </mdui-list>
    </div>
  );
}
