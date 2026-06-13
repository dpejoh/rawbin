import { useState, useCallback } from "react";

export interface Module {
  id: string;
  moduleId: string;
  name: string;
  version: string;
  versionCode: number;
  author: string;
  description: string;
  size: number;
  createdAt: string;
  updatedAt?: string;
}

interface UseModulesReturn {
  modules: Module[];
  isLoading: boolean;
  isUploading: boolean;
  fetchAll: (token: string) => Promise<Module[]>;
  upload: (token: string, file: File, metadata: { moduleId: string; name: string; version: string; versionCode: number; author: string; description: string }) => Promise<{ id: string } | null>;
  remove: (token: string, id: string) => Promise<boolean>;
}

export default function useModules(): UseModulesReturn {
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fetchAll = useCallback(async (token: string): Promise<Module[]> => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/modules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Module[] = await res.json();
        setModules(data);
        return data;
      }
      return [];
    } catch {
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const upload = useCallback(async (
    token: string,
    file: File,
    metadata: { moduleId: string; name: string; version: string; versionCode: number; author: string; description: string },
  ): Promise<{ id: string } | null> => {
    setIsUploading(true);
    try {
      if (false) return null;

      const key = `${metadata.moduleId}.zip`;
      const form = new FormData();
      form.append("file", file);
      const fileRes = await fetch(`/upload/modules?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!fileRes.ok) {
        const errText = await fileRes.text().catch(() => "");
        console.error("Worker upload failed:", errText);
        return null;
      }
      const { id: blobId, size } = await fileRes.json() as { id: string; size: number };

      const metaRes = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          blobId, size,
          moduleId: metadata.moduleId,
          name: metadata.name,
          version: metadata.version,
          versionCode: metadata.versionCode,
          author: metadata.author,
          description: metadata.description,
        }),
      });
      const metaData = await metaRes.json().catch(() => ({})) as Record<string, unknown>;
      if (metaData.error) {
        console.error("Metadata upload failed:", metaData.error);
        return null;
      }
      return metaData as { id: string };
    } catch (e) {
      console.error("Upload error:", e);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const remove = useCallback(async (token: string, id: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/modules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  return { modules, isLoading, isUploading, fetchAll, upload, remove };
}
