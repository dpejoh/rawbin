export function clipboardUrl(id: string, slug?: string): string {
  const path = slug ? `/clips/${slug}` : `/clips/${id}`;
  return `${window.location.origin}${path}`;
}
