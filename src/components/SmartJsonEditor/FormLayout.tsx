import type { FieldSchema } from './types';
import SmartField from './SmartField';

interface FormLayoutProps {
  data: Record<string, unknown>;
  fields: FieldSchema[];
  onChange: (data: Record<string, unknown>) => void;
}

export default function FormLayout({ data, fields, onChange }: FormLayoutProps) {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((schema) => (
        <SmartField
          key={schema.key}
          schema={schema}
          value={data[schema.key]}
          onChange={(val) => onChange({ ...data, [schema.key]: val })}
        />
      ))}
    </div>
  );
}
