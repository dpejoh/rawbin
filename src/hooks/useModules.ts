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
  updatedAt: string;
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
      const res = await fetch("/.netlify/functions/modules", {
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("moduleId", metadata.moduleId);
      formData.append("name", metadata.name);
      formData.append("version", metadata.version);
      formData.append("versionCode", String(metadata.versionCode));
      formData.append("author", metadata.author);
      formData.append("description", metadata.description);

      const res = await fetch("/.netlify/functions/modules", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const result = await res.json() as { id: string; moduleId: string };
        return result;
      }
      return null;
    } catch {
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const remove = useCallback(async (token: string, id: string): Promise<boolean> => {
    try {
      const res = await fetch("/.netlify/functions/modules", {
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
