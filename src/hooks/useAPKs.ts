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
  fileName?: string;
  createdAt: string;
  updatedAt?: string;
}

interface UseAPKsReturn {
  apks: APK[];
  isLoading: boolean;
  isUploading: boolean;
  fetchAll: (token: string) => Promise<APK[]>;
  upload: (token: string, file: File, metadata: { packageName: string; appName: string; versionCode: number; versionName: string }) => Promise<{ id: string } | null>;
  remove: (token: string, id: string) => Promise<boolean>;
}

const R2_WORKER = import.meta.env.VITE_R2_WORKER_URL ?? "http://localhost:8787";

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
      if (!R2_WORKER) return null;

      const fileRes = await fetch(`${R2_WORKER}/upload/apks`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: file,
      });
      if (!fileRes.ok) {
        const errText = await fileRes.text().catch(() => "");
        console.error("Worker upload failed:", errText);
        return null;
      }
      const { id: blobId, size } = await fileRes.json() as { id: string; size: number };

      const metaRes = await fetch("/.netlify/functions/apks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          blobId, size,
          packageName: metadata.packageName,
          appName: metadata.appName,
          versionCode: metadata.versionCode,
          versionName: metadata.versionName,
          fileName: file.name,
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
