import { useState, useCallback } from "react";

export interface Clipboard {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  content: string;
}

interface UseClipboardsReturn {
  clipboards: Clipboard[];
  selected: Clipboard | null;
  isLoading: boolean;
  isSaving: boolean;
  fetchAll: (token: string) => Promise<void>;
  select: (id: string | null) => void;
  create: (token: string, name: string) => Promise<string | null>;
  update: (token: string, id: string, data: { name?: string; content?: string }) => Promise<boolean>;
  remove: (token: string, id: string) => Promise<boolean>;
  fetchRawContent: (id: string) => Promise<string>;
}

export default function useClipboards(): UseClipboardsReturn {
  const [clipboards, setClipboards] = useState<Clipboard[]>([]);
  const [selected, setSelected] = useState<Clipboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAll = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/.netlify/functions/clipboards", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Clipboard[] = await res.json();
        setClipboards(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const select = useCallback(
    (id: string | null) => {
      const cb = id ? clipboards.find((c) => c.id === id) ?? null : null;
      setSelected(cb);
    },
    [clipboards]
  );

  const create = useCallback(
    async (token: string, name: string): Promise<string | null> => {
      setIsSaving(true);
      try {
        const res = await fetch("/.netlify/functions/clipboards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name }),
        });
        if (res.ok) {
          const { id } = await res.json() as { id: string };
          await fetchAll(token);
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
    async (token: string, id: string, data: { name?: string; content?: string }): Promise<boolean> => {
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
        if (res.ok) {
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
        if (res.ok) {
          setSelected((prev) => (prev?.id === id ? null : prev));
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

  const fetchRawContent = useCallback(async (id: string): Promise<string> => {
    const res = await fetch(`/.netlify/functions/clipboards/${id}`);
    if (!res.ok) return "";
    const text = await res.text();
    return atob(text);
  }, []);

  return {
    clipboards,
    selected,
    isLoading,
    isSaving,
    fetchAll,
    select,
    create,
    update,
    remove,
    fetchRawContent,
  };
}
