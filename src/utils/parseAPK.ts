import JSZip from 'jszip';
import { parseAXML, type ParsedManifest } from './parseAXML';

export async function parseAPK(file: File): Promise<ParsedManifest | null> {
  try {
    const arrayBuf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuf);

    let manifestBuf: ArrayBuffer;

    if (file.name.endsWith('.apks')) {
      const baseApk = zip.file('base.apk');
      if (!baseApk) return null;
      const baseBuf = await baseApk.async('arraybuffer');
      const baseZip = await JSZip.loadAsync(baseBuf);
      const manifestFile = baseZip.file('AndroidManifest.xml');
      if (!manifestFile) return null;
      manifestBuf = await manifestFile.async('arraybuffer');
    } else {
      const manifestFile = zip.file('AndroidManifest.xml');
      if (!manifestFile) return null;
      manifestBuf = await manifestFile.async('arraybuffer');
    }

    return parseAXML(manifestBuf);
  } catch {
    return null;
  }
}
