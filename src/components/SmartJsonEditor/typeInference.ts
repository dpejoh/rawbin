import type { FieldSchema, FieldType } from './types';

const URL_RE = /^https?:\/\/.+/;

const CONVENTIONS: Record<string, FieldType> = {
  enabled: 'triState',
  $ref: 'ref',
  url: 'url',
  download_url: 'url',
  createdAt: 'text',
  updatedAt: 'text',
};

function detectTypeFromValues(values: unknown[]): FieldType {
  const unique = new Set(values.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))));
  const uniqueCount = unique.size;

  const allBool = values.every((v) => typeof v === 'boolean');
  if (allBool) return 'boolean';

  const isNum = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
  if (values.every((v) => isNum(v))) {
    const nums = values as number[];
    const allInt = nums.every((n) => Number.isInteger(n));
    if (allInt) {
      const hasTwo = nums.includes(2);
      const onlyZeroOne = nums.every((n) => n === 0 || n === 1);
      if (onlyZeroOne) return 'boolean';
      if (hasTwo) return 'triState';
    }
    return 'number';
  }

  const allStr = values.every((v) => typeof v === 'string');
  if (allStr) {
    const strs = values as string[];
    const medianLen = strs.slice().sort((a, b) => a.length - b.length)[Math.floor(strs.length / 2)]?.length ?? 0;
    const allUrl = strs.every((s) => URL_RE.test(s));
    if (allUrl) return 'url';
    if (uniqueCount <= 5 && uniqueCount < values.length) return 'enum';
    if (medianLen > 100) return 'textarea';
    return 'text';
  }

  const allNull = values.every((v) => v === null);
  if (allNull) return 'null';

  const allObj = values.every((v) => typeof v === 'object' && v !== null && !Array.isArray(v));
  if (allObj) return 'object';

  const allArr = values.every((v) => Array.isArray(v));
  if (allArr) return 'array';

  return 'text';
}

export function inferFieldSchema(key: string, sampleValues: unknown[]): FieldSchema {
  const convention = CONVENTIONS[key];
  let type: FieldType;

  if (convention === 'triState' && !sampleValues.some((v) => v === 2 || v === '2')) {
    type = 'boolean';
  } else if (convention) {
    type = convention;
  } else {
    type = detectTypeFromValues(sampleValues);
  }

  if (type === 'enum') {
    const unique = [...new Set(sampleValues.map((v) => String(v)))].sort();
    return { key, type, enumValues: unique };
  }

  if (type === 'object' || type === 'array') {
    return { key, type, nestedType: type };
  }

  return { key, type };
}

export function analyzeShape(data: unknown): { kind: 'cardList' | 'form' | 'primitive'; fields?: FieldSchema[] } {
  if (Array.isArray(data) && data.length > 0 && data.every((i) => typeof i === 'object' && i !== null && !Array.isArray(i))) {
    const allKeys = [...new Set(data.flatMap((item) => Object.keys(item as Record<string, unknown>)))];
    const fields = allKeys.map((key) => {
      const values = data.map((item) => (item as Record<string, unknown>)[key]);
      return inferFieldSchema(key, values);
    });
    return { kind: 'cardList', fields };
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const entries = data as Record<string, unknown>;
    const fields = Object.keys(entries).map((key) => {
      const values = [entries[key]];
      return inferFieldSchema(key, values);
    });
    return { kind: 'form', fields };
  }

  return { kind: 'primitive' };
}
