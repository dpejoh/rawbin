import type { FieldSchema } from './types';
import BooleanField from './controls/BooleanField';
import TriStateField from './controls/TriStateField';
import EnumField from './controls/EnumField';
import URLField from './controls/URLField';
import TextFieldControl from './controls/TextField';
import TextAreaField from './controls/TextAreaField';
import NumberField from './controls/NumberField';
import RefField from './controls/RefField';

interface SmartFieldProps {
  schema: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

export default function SmartField({ schema, value, onChange }: SmartFieldProps) {
  switch (schema.type) {
    case 'boolean':
      return (
        <BooleanField
          value={value as boolean | number}
          onChange={onChange}
          label={schema.key}
        />
      );
    case 'triState':
      return (
        <TriStateField
          value={(value as number) ?? 0}
          onChange={onChange}
          label={schema.key}
        />
      );
    case 'enum':
      return (
        <EnumField
          value={(value as string) ?? ''}
          onChange={onChange}
          label={schema.key}
          options={schema.enumValues!}
        />
      );
    case 'url':
      return (
        <URLField
          value={(value as string) ?? ''}
          onChange={onChange}
          label={schema.key}
        />
      );
    case 'textarea':
      return (
        <TextAreaField
          value={(value as string) ?? ''}
          onChange={onChange}
          label={schema.key}
        />
      );
    case 'number':
      return (
        <NumberField
          value={(value as number) ?? 0}
          onChange={onChange}
          label={schema.key}
        />
      );
    case 'ref':
      return (
        <RefField
          value={(value as string) ?? ''}
          onChange={onChange}
          label={schema.key}
        />
      );
    case 'null':
      return null;
    default:
      return (
        <TextFieldControl
          value={(value as string) ?? ''}
          onChange={onChange}
          label={schema.key}
        />
      );
  }
}
