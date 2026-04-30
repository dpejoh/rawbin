export type ContentType = 'xml' | 'json' | 'pem' | 'base64' | 'yaml' | 'toml' | 'empty' | 'text';

interface TypeInfo {
  type: ContentType;
  label: string;
  color: 'key' | 'json' | 'xml' | 'empty' | 'text';
}

export function detectContentType(content: string): TypeInfo {
  const trimmed = content.trim();
  if (!trimmed) return { type: 'empty', label: 'empty', color: 'empty' };

  const head = trimmed.slice(0, 200);

  if (/^<\?xml\s/i.test(head) || /^<[!?]/.test(head) || /^<(\w+:)?\w+/.test(head)) {
    return { type: 'xml', label: 'XML', color: 'xml' };
  }

  if (/^\s*[\{\[]/.test(head) || /^\s*"\w+":/.test(head)) {
    return { type: 'json', label: 'JSON', color: 'json' };
  }

  if (/^-----BEGIN\s/.test(head)) {
    return { type: 'pem', label: 'PEM', color: 'key' };
  }

  if (/^(https?:\/\/)/.test(head)) {
    return { type: 'text', label: 'URL', color: 'text' };
  }

  const base64Test = trimmed.replace(/\s/g, '');
  if (base64Test.length > 40 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64Test)) {
    const entropy = (base64Test.match(/[A-Z]/g)?.length ?? 0) / base64Test.length;
    const digitRatio = (base64Test.match(/\d/g)?.length ?? 0) / base64Test.length;
    if (entropy > 0.4 && digitRatio > 0.1 && base64Test.length > 80) {
      return { type: 'base64', label: 'base64', color: 'text' };
    }
  }

  if (/^---\s/.test(head) || /^\w+:\s/.test(head)) {
    return { type: 'yaml', label: 'YAML', color: 'xml' };
  }

  if (/^\w+\s*=\s*/.test(head)) {
    return { type: 'toml', label: 'TOML', color: 'text' };
  }

  return { type: 'text', label: 'text', color: 'text' };
}
