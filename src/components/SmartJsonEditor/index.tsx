import { useMemo, useCallback } from "react";
import { analyzeShape } from "./typeInference";
import CardListLayout from "./CardListLayout";
import FormLayout from "./FormLayout";

interface SmartJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SmartJsonEditor({ value, onChange }: SmartJsonEditorProps) {
  const { parsed, shape, error } = useMemo(() => {
    try {
      const p = JSON.parse(value);
      const s = analyzeShape(p);
      return { parsed: p, shape: s, error: null };
    } catch (e) {
      return { parsed: null, shape: null, error: (e as Error).message };
    }
  }, [value]);

  const handleChange = useCallback(
    (newData: unknown) => {
      onChange(JSON.stringify(newData, null, 2));
    },
    [onChange]
  );

  if (error) {
    return (
      <div className="p-3">
        <p className="text-sm font-mono text-destructive">
          Invalid JSON — switch to Text mode to fix syntax.
        </p>
      </div>
    );
  }

  if (shape?.kind === 'cardList' && shape.fields) {
    return (
      <CardListLayout
        data={parsed as Record<string, unknown>[]}
        fields={shape.fields}
        onChange={(data) => handleChange(data)}
      />
    );
  }

  if (shape?.kind === 'form' && shape.fields) {
    return (
      <div className="p-2">
        <FormLayout
          data={parsed as Record<string, unknown>}
          fields={shape.fields}
          onChange={(data) => handleChange(data)}
        />
      </div>
    );
  }

  return (
    <div className="p-3">
      <p className="text-sm font-mono text-muted-foreground">
        {JSON.stringify(parsed)}
      </p>
    </div>
  );
}
