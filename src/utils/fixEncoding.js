/**
 * Detecta si un string tiene encoding roto (latin-1 leído como UTF-8).
 * Patrón típico: "Ã³" en lugar de "ó", "Ã±" en lugar de "ñ", etc.
 */
function tieneEncodingRoto(str) {
  // Secuencias características de latin-1 mal decodificado
  return /Ã[²³¡¢£¤¥¦§¨©ª«¬­®¯°±µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ\x80-\xbf]/.test(str);
}

/**
 * Repara texto con encoding roto (latin-1 leído como UTF-8).
 * Solo intenta reparar si detecta el patrón, para no romper texto ya correcto.
 * Ej: "CinturÃ³n" → "Cinturón"
 */
export function fixEncoding(str) {
  if (typeof str !== 'string') return str;
  if (!tieneEncodingRoto(str)) return str;
  try {
    const bytes = new Uint8Array(str.split('').map(c => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    // Si la decodificación produce más caracteres raros, devolver el original
    return tieneEncodingRoto(decoded) ? str : decoded;
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
