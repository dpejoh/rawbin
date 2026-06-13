import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface BooleanFieldProps {
  value: boolean | number;
  onChange: (value: boolean | number) => void;
  label: string;
}

export default function BooleanField({ value, onChange, label }: BooleanFieldProps) {
  const checked = typeof value === 'number' ? value === 1 : value === true;
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={(v) => onChange(typeof value === 'number' ? (v ? 1 : 0) : v)}
      />
      <Label className="text-xs font-mono text-muted-foreground">{label}</Label>
    </div>
  );
}
