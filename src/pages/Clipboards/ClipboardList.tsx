import { useCallback, useState, useRef, useEffect } from 'react';
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
  const listRef = useRef<any>(null);
  const menuRefs = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const item = (e.target as HTMLElement).closest('mdui-list-item');
      if (item) {
        const id = item.getAttribute('data-value');
        if (id) onSelect(id);
      }
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onSelect]);

  useEffect(() => {
    const map = menuRefs.current;
    const handler = (e: Event) => {
      const menu = e.target as any;
      const id = menu.getAttribute('data-id');
      const action = menu.value;
      if (!id || !action) return;
      if (action === 'rename') onRename(id);
      else if (action === 'copy') onCopyUrl(id);
      else if (action === 'delete') onDelete(id);
    };
    for (const [, menu] of map) {
      menu.addEventListener('change', handler);
    }
    return () => {
      for (const [, menu] of map) {
        menu.removeEventListener('change', handler);
      }
    };
  }, [onRename, onCopyUrl, onDelete]);

  const setMenuRef = useCallback(
    (id: string) => (el: any) => {
      if (el) menuRefs.current.set(id, el);
      else menuRefs.current.delete(id);
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="clipboard-panel" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 64 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="clipboard-panel">
      <mdui-list ref={listRef}>
        {clipboards.map((cb) => {
          const isActive = cb.id === selectedId;
          return (
            <mdui-list-item
              key={cb.id}
              data-value={cb.id}
              icon="description"
              rounded
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
                  <mdui-menu ref={setMenuRef(cb.id)} data-id={cb.id}>
                    <mdui-menu-item value="rename" icon="drive_file_rename_outline">Rename</mdui-menu-item>
                    <mdui-menu-item value="copy" icon="link">Copy raw URL</mdui-menu-item>
                    <mdui-divider />
                    <mdui-menu-item value="delete" icon="delete_outline">Delete</mdui-menu-item>
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
