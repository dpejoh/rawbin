import { useState, useCallback, useRef } from "react";

export interface Clipboard {
  id: string;
  name: string;
  slug?: string;
  useBase64?: boolean;
  createdAt: string;
  updatedAt?: string;
  content: string;
}

interface UseClipboardsReturn {
  clipboards: Clipboard[];
  selected: Clipboard | null;
  selectedId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  fetchAll: (token: string) => Promise<Clipboard[]>;
  select: (id: string | null) => void;
  create: (token: string, name: string, slug?: string, useBase64?: boolean) => Promise<string | null>;
  update: (token: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean }) => Promise<boolean>;
  remove: (token: string, id: string) => Promise<boolean>;
}

export default function useClipboards(): UseClipboardsReturn {
  const [clipboards, setClipboards] = useState<Clipboard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const clipboardsRef = useRef(clipboards);
  clipboardsRef.current = clipboards;

  const selected = selectedId ? clipboards.find((c) => c.id === selectedId) ?? null : null;

  const fetchAll = useCallback(async (token: string): Promise<Clipboard[]> => {
    setIsLoading(true);
    try {
      const res = await fetch("/.netlify/functions/clipboards", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Clipboard[] = await res.json();
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

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
    },
    []
  );

  const create = useCallback(
    async (token: string, name: string, slug?: string, useBase64?: boolean): Promise<string | null> => {
      setIsSaving(true);
      try {
        const res = await fetch("/.netlify/functions/clipboards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, slug: slug || undefined, useBase64: useBase64 !== false }),
        });
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (!data.error) {
          const id = data.id as string;
          await fetchAll(token);
          setSelectedId(id);
          return id;
        }
        return null;
      } catch {
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchAll]
  );

  const update = useCallback(
    async (token: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean }): Promise<boolean> => {
      setIsSaving(true);
      try {
        const res = await fetch(`/.netlify/functions/clipboards`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id, ...data }),
        });
        const resData = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (!resData.error) {
          await fetchAll(token);
          return true;
        }
        return false;
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
        const res = await fetch("/.netlify/functions/clipboards", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id }),
        });
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (!data.error) {
          setSelectedId((prev) => (prev === id ? null : prev));
          await fetchAll(token);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchAll]
  );

  return {
    clipboards,
    selected,
    selectedId,
    isLoading,
    isSaving,
    fetchAll,
    select,
    create,
    update,
    remove,
  };
}
