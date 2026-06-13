export type FieldType =
  | 'boolean'
  | 'triState'
  | 'enum'
  | 'url'
  | 'textarea'
  | 'text'
  | 'number'
  | 'ref'
  | 'object'
  | 'array'
  | 'null';

export interface FieldSchema {
  key: string;
  type: FieldType;
  enumValues?: string[];
  nestedType?: 'object' | 'array';
}

export interface ShapeInfo {
  kind: 'cardList' | 'form' | 'primitive';
  fields?: FieldSchema[];
}

export function isArrayOfObjects(data: unknown): data is Record<string, unknown>[] {
  return Array.isArray(data) && data.length > 0 && data.every((i) => typeof i === 'object' && i !== null && !Array.isArray(i));
}

export function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}
