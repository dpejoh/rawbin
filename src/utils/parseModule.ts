import JSZip from 'jszip';

export interface ParsedModule {
  moduleId: string;
  name: string;
  version: string;
  versionCode: number;
  author: string;
  description: string;
}

export async function parseModule(file: File): Promise<ParsedModule | null> {
  try {
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const propFile = zip.file("module.prop");
    if (!propFile) return null;
    const text = await propFile.async("string");

    const lines = text.split(/\r?\n/);
    const props: Record<string, string> = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      props[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }

    const id = (props.id ?? "").trim();
    const name = (props.name ?? id).trim();
    const version = (props.version ?? "").trim();
    const versionCode = parseInt(props.versionCode ?? "", 10) || 0;
    const author = (props.author ?? "").trim();
    const description = (props.description ?? "").trim();

    if (!id) return null;

    return { moduleId: id, name, version, versionCode, author, description };
  } catch {
    return null;
  }
}
