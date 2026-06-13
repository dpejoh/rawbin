import { Input } from "@/components/ui/input";

interface RefFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export default function RefField({ value, onChange, label }: RefFieldProps) {
  const colonIdx = value.indexOf(':');
  const refType = colonIdx !== -1 ? value.slice(0, colonIdx) : null;
  const refId = colonIdx !== -1 ? value.slice(colonIdx + 1) : value;

  return (
    <div>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {value && refType ? (
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded leading-none ${
            refType === 'apk' ? 'text-green-400 bg-green-400/15' : 'text-primary bg-primary/15'
          }`}>
            {refType}
          </span>
          <span className="font-mono text-xs text-foreground">{refId}</span>
        </div>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="type:id"
          className="font-mono text-xs h-8"
        />
      )}
    </div>
  );
}
