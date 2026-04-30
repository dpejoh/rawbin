import { useState, useCallback, useEffect, useRef } from 'react';
import { snackbar } from 'mdui';

interface RawUrlRowProps {
  url: string;
}

export default function RawUrlRow({ url }: RawUrlRowProps) {
  const [copied, setCopied] = useState(false);
  const btnRef = useRef<any>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      snackbar({ message: 'Raw URL copied', placement: 'bottom', autoCloseDelay: 2000 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      snackbar({ message: 'Failed to copy', placement: 'bottom', autoCloseDelay: 2000 });
    }
  }, [url]);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    el.addEventListener('click', handleCopy);
    return () => el.removeEventListener('click', handleCopy);
  }, [handleCopy]);

  return (
    <div className="raw-url-strip">
      <span className="raw-url-text">{url}</span>
      <mdui-tooltip content="Copy raw URL">
        <mdui-button-icon
          ref={btnRef}
          icon={copied ? 'check' : 'content_copy'}
          style={copied ? { color: 'var(--mdui-color-primary)' } : undefined}
        />
      </mdui-tooltip>
    </div>
  );
}
