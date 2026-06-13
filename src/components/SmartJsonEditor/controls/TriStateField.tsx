interface TriStateFieldProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

const states = [
  { value: 0, label: 'Off', activeClass: 'bg-red-400/15 text-red-400 border-red-400/30' },
  { value: 1, label: 'On', activeClass: 'bg-green-400/15 text-green-400 border-green-400/30' },
  { value: 2, label: 'Prompt', activeClass: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30' },
];

export default function TriStateField({ value, onChange, label }: TriStateFieldProps) {
  return (
    <div>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="flex gap-1">
        {states.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`px-2.5 py-0.5 text-xs font-mono rounded border transition-colors ${
              value === s.value
                ? s.activeClass
                : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
