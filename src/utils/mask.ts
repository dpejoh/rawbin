export function maskContent(text: string): string {
  if (!text) return '';
  if (text.length <= 16) return '\u2022'.repeat(text.length);
  const first = text.slice(0, 8);
  const last = text.slice(-8);
  const dots = '\u2022'.repeat(Math.min(text.length - 16, 64));
  return first + dots + '\n' + '\u2022'.repeat(Math.min(text.length, 32)) + '\n' + last;
}
