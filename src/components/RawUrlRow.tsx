import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface RawUrlRowProps {
  url: string;
}

export default function RawUrlRow({ url }: RawUrlRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast('Raw URL copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  }, [url]);

  return (
    <div className="flex items-center gap-2 rounded-md bg-card px-3 py-2 border">
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground font-mono">
        {url}
      </span>
      <button
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Copy raw URL"
      >
        {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
