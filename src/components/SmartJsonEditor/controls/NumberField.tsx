import { Input } from "@/components/ui/input";

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

export default function NumberField({ value, onChange, label }: NumberFieldProps) {
  return (
    <div>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? 0 : Number(v));
        }}
        className="font-mono text-xs h-8"
      />
    </div>
  );
}
