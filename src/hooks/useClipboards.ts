import { useState, useCallback, useRef } from "react";

export interface ClipboardItem {
  id: string;
  name: string;
  slug?: string;
  useBase64?: boolean;
  useShuffle?: boolean;
  createdAt: string;
  updatedAt?: string;
  content: string;
}

interface UseClipboardsReturn {
  clipboards: ClipboardItem[];
  selected: ClipboardItem | null;
  selectedId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  fetchAll: (token: string) => Promise<ClipboardItem[]>;
  select: (id: string | null) => void;
  create: (token: string, name: string, slug?: string, useBase64?: boolean, useShuffle?: boolean) => Promise<string | null>;
  update: (token: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean; useShuffle?: boolean }) => Promise<boolean>;
  remove: (token: string, id: string) => Promise<boolean>;
}

export default function useClipboards(): UseClipboardsReturn {
  const [clipboards, setClipboards] = useState<ClipboardItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const clipboardsRef = useRef(clipboards);
  clipboardsRef.current = clipboards;

  const selected = selectedId ? clipboards.find((c) => c.id === selectedId) ?? null : null;

  const fetchAll = useCallback(async (token: string): Promise<ClipboardItem[]> => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/clipboards", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: ClipboardItem[] = await res.json();
        setClipboards(data);
        return data;
      }
      return [];
    } catch {
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const create = useCallback(
    async (token: string, name: string, slug?: string, useBase64?: boolean, useShuffle?: boolean): Promise<string | null> => {
      setIsSaving(true);
      try {
        const res = await fetch("/api/clipboards", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, slug, useBase64, useShuffle }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { id: string };
        await fetchAll(token);
        return data.id;
      } catch {
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchAll]
  );

  const update = useCallback(
    async (token: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean; useShuffle?: boolean }): Promise<boolean> => {
      setIsSaving(true);
      try {
        const res = await fetch("/api/clipboards", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id, ...data }),
        });
        const ok = res.ok;
        if (ok) await fetchAll(token);
        return ok;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchAll]
  );

  const remove = useCallback(
    async (token: string, id: string): Promise<boolean> => {
      setIsSaving(true);
      try {
        const res = await fetch("/api/clipboards", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id }),
        });
        const ok = res.ok;
        if (ok && selectedId === id) setSelectedId(null);
        return ok;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [selectedId]
  );

  return { clipboards, selected, selectedId, isLoading, isSaving, fetchAll, select, create, update, remove };
}
