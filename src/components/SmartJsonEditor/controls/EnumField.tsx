import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EnumFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: string[];
}

export default function EnumField({ value, onChange, label, options }: EnumFieldProps) {
  return (
    <div>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full font-mono text-xs h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="font-mono text-xs">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
