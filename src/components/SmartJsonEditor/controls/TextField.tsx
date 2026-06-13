import { Input } from "@/components/ui/input";

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}

export default function TextField({ value, onChange, label, placeholder }: TextFieldProps) {
  return (
    <div>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-xs h-8"
      />
    </div>
  );
}
