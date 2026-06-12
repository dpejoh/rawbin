import { useState, useCallback } from "react";

export interface APK {
  id: string;
  packageName: string;
  appName: string;
  versionCode: number;
  versionName: string;
  minSdk: number;
  targetSdk: number;
  size: number;
  createdAt: string;
  updatedAt: string;
}

interface UseAPKsReturn {
  apks: APK[];
  isLoading: boolean;
  isUploading: boolean;
  fetchAll: (token: string) => Promise<APK[]>;
  upload: (token: string, file: File, metadata: { packageName: string; appName: string; versionCode: number; versionName: string }) => Promise<{ id: string } | null>;
  remove: (token: string, id: string) => Promise<boolean>;
}

export default function useAPKs(): UseAPKsReturn {
  const [apks, setApks] = useState<APK[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fetchAll = useCallback(async (token: string): Promise<APK[]> => {
    setIsLoading(true);
    try {
      const res = await fetch("/.netlify/functions/apks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: APK[] = await res.json();
        setApks(data);
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
    metadata: { packageName: string; appName: string; versionCode: number; versionName: string },
  ): Promise<{ id: string } | null> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("packageName", metadata.packageName);
      formData.append("appName", metadata.appName);
      formData.append("versionCode", String(metadata.versionCode));
      formData.append("versionName", metadata.versionName);

      const res = await fetch("/.netlify/functions/apks", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const result = await res.json() as { id: string; packageName: string };
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
      const res = await fetch("/.netlify/functions/apks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  return { apks, isLoading, isUploading, fetchAll, upload, remove };
}
