export interface ParsedManifest {
  packageName: string;
  versionCode: number;
  versionName: string;
  label?: string;
}

export function parseAXML(buffer: ArrayBuffer): ParsedManifest | null {
  const dv = new DataView(buffer);
  let pos = 0;

  if (dv.getUint16(pos, true) !== 0x0003) return null;
  pos += 8;

  let stringPool: { chunkSize: number; offset: number } | null = null;

  while (pos < buffer.byteLength) {
    const chunkType = dv.getUint16(pos, true);
    const chunkSize = dv.getUint32(pos + 4, true);
    if (chunkSize === 0) break;

    if (chunkType === 0x0001) {
      stringPool = { chunkSize, offset: pos };
      break;
    }
    pos += chunkSize;
  }

  if (!stringPool) return null;

  const pool = new DataView(buffer, stringPool.offset, stringPool.chunkSize);
  const stringCount = pool.getUint32(8, true);
  const flags = pool.getUint32(16, true);
  const stringsStart = pool.getUint32(20, true);
  const isUTF8 = !!(flags & (1 << 8));

  function getString(idx: number): string {
    if (idx < 0 || idx >= stringCount) return '';
    const strOff = pool.getUint32(28 + idx * 4, true);
    const absOff = stringPool!.offset + stringsStart + strOff;

    if (isUTF8) {
      let charLen: number;
      const b0 = dv.getUint8(absOff);
      if (b0 & 0x80) {
        charLen = ((b0 & 0x7F) << 8) | dv.getUint8(absOff + 1);
      } else {
        charLen = b0;
      }
      let strStart = absOff + (b0 & 0x80 ? 2 : 1);
      const bbl = dv.getUint8(strStart);
      let byteLen: number;
      if (bbl & 0x80) {
        byteLen = ((bbl & 0x7F) << 8) | dv.getUint8(strStart + 1);
        strStart += 2;
      } else {
        byteLen = bbl;
        strStart += 1;
      }
      const bytes = new Uint8Array(buffer, strStart, byteLen);
      return new TextDecoder().decode(bytes);
    } else {
      let charLen: number;
      const first = dv.getUint16(absOff, true);
      if (first & 0x8000) {
        charLen = first & 0x7FFF;
      } else {
        charLen = first;
      }
      if (charLen === 0) return '';
      const strStart = absOff + 2;
      const chars: string[] = [];
      for (let i = 0; i < charLen; i++) {
        const code = dv.getUint16(strStart + i * 2, true);
        if (code === 0) break;
        chars.push(String.fromCharCode(code));
      }
      return chars.join('');
    }
  }

  const androidNsStr = "http://schemas.android.com/apk/res/android";
  let androidNsIdx = -1, pkgIdx = -1, vcIdx = -1, vnIdx = -1;
  let manifestIdx = -1, applicationIdx = -1, labelIdx = -1;

  for (let i = 0; i < stringCount; i++) {
    const s = getString(i);
    if (s === "android") continue;
    if (s === "manifest") manifestIdx = i;
    else if (s === "application") applicationIdx = i;
    else if (s === "package") pkgIdx = i;
    else if (s === "versionCode") vcIdx = i;
    else if (s === "versionName") vnIdx = i;
    else if (s === "label") labelIdx = i;
    else if (s === androidNsStr) androidNsIdx = i;
  }

  if (manifestIdx < 0) return null;

  const result: Partial<ParsedManifest> = {};
  pos = stringPool.offset + stringPool.chunkSize;

  while (pos < buffer.byteLength) {
    const chunkType = dv.getUint16(pos, true);
    const chunkSize = dv.getUint32(pos + 4, true);
    if (chunkSize === 0) break;

    if (chunkType === 0x0102) {
      const name = dv.getUint32(pos + 20, true);
      const attributeCount = dv.getUint16(pos + 28, true);
      const attributeSize = dv.getUint16(pos + 26, true);
      const attributeStart = dv.getUint16(pos + 24, true);

      const attrBase = pos + 16 + attributeStart;
      for (let i = 0; i < attributeCount; i++) {
        const attrOff = attrBase + i * attributeSize;
        const attrNs = dv.getUint32(attrOff, true) >>> 0;
        const attrName = dv.getUint32(attrOff + 4, true);
        const attrRawValue = dv.getUint32(attrOff + 8, true);
        const tvType = dv.getUint8(attrOff + 15);
        const tvData = dv.getUint32(attrOff + 16, true);

        if (name === manifestIdx) {
          if (attrName === vcIdx && attrNs === androidNsIdx && tvType === 0x10) {
            result.versionCode = tvData;
          } else if (attrName === vnIdx && attrNs === androidNsIdx && tvType === 0x03 && attrRawValue < stringCount) {
            result.versionName = getString(attrRawValue);
          } else if (attrName === pkgIdx && attrNs === 0xFFFFFFFF) {
            if (tvType === 0x03 && attrRawValue < stringCount) {
              result.packageName = getString(attrRawValue);
            }
          }
        }

        if (name === applicationIdx && attrName === labelIdx && attrNs === androidNsIdx) {
          if (tvType === 0x03 && attrRawValue < stringCount) {
            result.label = getString(attrRawValue);
          }
        }
      }

      if (result.packageName && (result.label !== undefined || name === applicationIdx)) {
        break;
      }
    }

    pos += chunkSize;
  }

  if (!result.packageName) return null;
  return {
    packageName: result.packageName,
    versionCode: result.versionCode ?? 0,
    versionName: result.versionName ?? "",
    label: result.label,
  };
}
