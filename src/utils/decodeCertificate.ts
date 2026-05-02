export interface DecodedCert {
  serial: string;
}

export function decodeCertificate(xmlContent: string): DecodedCert | null {
  const certMatch = xmlContent.match(/<Certificate>([\s\S]*?)<\/Certificate>/);
  if (!certMatch) return null;

  const pemRaw = certMatch[1];
  if (!pemRaw) return null;
  let pem = pemRaw.trim();
  pem = pem.replace(/-----BEGIN CERTIFICATE-----/g, '');
  pem = pem.replace(/-----END CERTIFICATE-----/g, '');
  pem = pem.replace(/\s/g, '');

  if (!pem) return null;

  try {
    const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
    const hex = Array.from(der).map(b => b.toString(16).padStart(2, '0')).join('');

    const idx = hex.indexOf('020a');
    if (idx === -1) return null;

    const serialHex = hex.slice(idx + 4, idx + 24);
    if (serialHex.length < 2) return null;

    const serial = BigInt('0x' + serialHex).toString();
    return { serial };
  } catch {
    return null;
  }
}

export function decodeCertificateServer(content: string): { serial: string } | null {
  const certMatch = content.match(/<Certificate>([\s\S]*?)<\/Certificate>/);
  if (!certMatch) return null;

  const pemRaw = certMatch[1];
  if (!pemRaw) return null;
  let pem = pemRaw.trim();
  pem = pem.replace(/-----BEGIN CERTIFICATE-----/g, '');
  pem = pem.replace(/-----END CERTIFICATE-----/g, '');
  pem = pem.replace(/\s/g, '');

  if (!pem) return null;

  try {
    const buf = Buffer.from(pem, 'base64');
    const hex = buf.toString('hex');

    const idx = hex.indexOf('020a');
    if (idx === -1) return null;

    const serialHex = hex.slice(idx + 4, idx + 24);
    if (serialHex.length < 2) return null;

    const serial = BigInt('0x' + serialHex).toString();
    return { serial };
  } catch {
    return null;
  }
}
