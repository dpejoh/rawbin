import { useState, useCallback } from "react";

const RAW_URL = "/.netlify/functions/raw";

interface UseKeyboxReturn {
  content: string;
  isLoading: boolean;
  isSaving: boolean;
  setContent: (v: string) => void;
  fetchContent: () => Promise<void>;
  saveContent: (token: string) => Promise<boolean>;
}

export default function useKeybox(): UseKeyboxReturn {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(RAW_URL);
      if (res.ok) {
        const text = await res.text();
        setContent(atob(text));
      }
    } catch {
      // no content yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveContent = useCallback(async (token: string): Promise<boolean> => {
    setIsSaving(true);
    try {
      const res = await fetch("/.netlify/functions/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [content]);

  return { content, isLoading, isSaving, setContent, fetchContent, saveContent };
}
