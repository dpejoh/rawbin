import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";

interface URLFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export default function URLField({ value, onChange, label }: URLFieldProps) {
  return (
    <div>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="font-mono text-xs h-8 pr-8"
        />
        {value && (
          <button
            onClick={() => window.open(value, '_blank', 'noopener')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80"
          >
            <ExternalLink className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
