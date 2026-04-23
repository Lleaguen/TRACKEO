/**
 * Repara texto con encoding roto (latin-1 leído como UTF-8)
 * Ej: "CinturÃ³n" → "Cinturón"
 */
export function fixEncoding(str) {
  if (typeof str !== 'string') return str;
  try {
    // Convierte cada char a byte y redecodifica como latin-1 → utf-8
    const bytes = new Uint8Array(str.split('').map(c => c.charCodeAt(0) & 0xff));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return str;
  }
}

export function fixRow(row) {
  const fixed = {};
  for (const [key, val] of Object.entries(row)) {
    fixed[key] = typeof val === 'string' ? fixEncoding(val) : val;
  }
  return fixed;
}
