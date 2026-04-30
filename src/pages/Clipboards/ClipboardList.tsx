import { useMemo } from 'react';
import { relativeTime } from '../../utils/time';
import { detectContentType } from '../../utils/detectType';
import type { Clipboard } from '../../hooks/useClipboards';
import type { ContentType } from '../../utils/detectType';

interface ClipboardListProps {
  clipboards: Clipboard[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onCopyUrl: (id: string) => void;
  onDelete: (id: string) => void;
}

const typeColorMap: Record<string, string> = {
  json:  'var(--mdui-color-tertiary)',
  xml:   'var(--mdui-color-secondary)',
  pem:   'var(--mdui-color-primary)',
  yaml:  'var(--mdui-color-tertiary)',
  toml:  'var(--mdui-color-secondary)',
  text:  'var(--mdui-color-on-surface-variant)',
  empty: 'var(--mdui-color-outline)',
  base64:'var(--mdui-color-on-surface-variant)',
};

const typeBgMap: Record<string, string> = {
  json:  'var(--mdui-color-tertiary-container)',
  xml:   'var(--mdui-color-secondary-container)',
  pem:   'var(--mdui-color-primary-container)',
  yaml:  'var(--mdui-color-tertiary-container)',
  toml:  'var(--mdui-color-secondary-container)',
  text:  'var(--mdui-color-surface-container-high)',
  empty: 'var(--mdui-color-surface-container)',
  base64:'var(--mdui-color-surface-container-high)',
};

export default function ClipboardList({
  clipboards,
  selectedId,
  isLoading,
  onSelect,
  onRename,
  onCopyUrl,
  onDelete,
}: ClipboardListProps) {
  const typeInfoMap = useMemo(() => {
    const map: Record<string, { type: ContentType; label: string; color: string }> = {};
    for (const cb of clipboards) {
      const info = detectContentType(cb.content ?? '');
      map[cb.id] = info;
    }
    return map;
  }, [clipboards]);

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
      <mdui-list>
        {clipboards.map((cb) => {
          const isActive = cb.id === selectedId;
          const typeInfo = typeInfoMap[cb.id];
          return (
            <mdui-list-item
              key={cb.id}
              icon="description"
              rounded
              active={isActive}
              onClick={() => onSelect(cb.id)}
            >
              {cb.name}
              <span slot="description" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {relativeTime(cb.updatedAt)} · {cb.content.length.toLocaleString()} chars
                {typeInfo && typeInfo.type !== 'text' && typeInfo.type !== 'empty' && (
                  <span
                    className="type-badge"
                    style={{
                      color: typeColorMap[typeInfo.type] ?? 'var(--mdui-color-on-surface-variant)',
                      backgroundColor: typeBgMap[typeInfo.type] ?? 'var(--mdui-color-surface-container-high)',
                    }}
                  >
                    {typeInfo.label}
                  </span>
                )}
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
                      onClick={(e) => { e.stopPropagation(); onRename(cb.id); }}
                    >
                      Rename
                    </mdui-menu-item>
                    <mdui-menu-item
                      icon="link"
                      onClick={(e) => { e.stopPropagation(); onCopyUrl(cb.id); }}
                    >
                      Copy raw URL
                    </mdui-menu-item>
                    <mdui-divider />
                    <mdui-menu-item
                      icon="delete_outline"
                      onClick={(e) => { e.stopPropagation(); onDelete(cb.id); }}
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
