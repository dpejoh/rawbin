export function decodeContent(raw: string, useBase64: boolean): string {
  if (!useBase64) return raw;
  try { return atob(raw); } catch { return raw; }
}
