import { Textarea } from "@/components/ui/textarea";

interface TextAreaFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export default function TextAreaField({ value, onChange, label }: TextAreaFieldProps) {
  return (
    <div>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs min-h-[60px]"
      />
    </div>
  );
}
