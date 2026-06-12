export function guessAppName(packageName: string): string {
  const cleaned = packageName.replace(/^(com|org|net|io|app|co|me|dev|store|club|xyz)\./i, "");
  const parts = cleaned.split(/[._-]/);
  return parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}
