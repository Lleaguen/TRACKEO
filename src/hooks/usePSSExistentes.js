import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { fixRow } from '../utils/fixEncoding';

// ─── Normalización ────────────────────────────────────────────────────────────

function normalizar(str) {
  return String(str == null ? '' : str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quita acentos: ó→o, á→a, etc.
    .replace(/[^a-z0-9\s]/g, ' ')    // símbolos y puntuación → espacio
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'de','del','la','las','el','los','un','una','unos','unas',
  'en','con','por','para','sin','sobre','entre','hasta','desde',
  'que','como','mas','pero','sus','les','nos','fue',
  'ser','han','hay','son','era','este','esta','estos','estas',
  'ese','esa','esos','esas','muy','bien','mal','menos',
  'todo','toda','todos','todas','cada','otro','otra','otros','otras',
]);

function tokenizar(desc) {
  return normalizar(desc)
    .split(/\s+/)
    .filter(p => p.length > 2 && !STOPWORDS.has(p));
}

// ─── Score ────────────────────────────────────────────────────────────────────

// Reglas:
// 1. Match exacto → 1.0 punto
// 2. Containment bidireccional SOLO si ambos tokens tienen ≥5 chars → 0.7 puntos
//    (evita que "pan" matchee "pantalon", "par" matchee "paraguas", etc.)
// 3. Score final = suma_hits / cantidad_tokens_query
// 4. Umbral: > 0.45 para mostrar badge, > 0.35 para ordenar

function calcularScore(tokensQuery, tokensPss) {
  if (!tokensQuery.length || !tokensPss.length) return 0;

  const setPss = new Set(tokensPss);
  let hits = 0;

  for (const t of tokensQuery) {
    if (setPss.has(t)) {
      hits += 1.0;
      continue;
    }
    // Containment solo para tokens suficientemente largos (≥5 chars)
    // para evitar falsos positivos con palabras cortas
    if (t.length >= 5) {
      const partial = tokensPss.find(tp => tp.length >= 5 && (tp.includes(t) || t.includes(tp)));
      if (partial) {
        hits += 0.7;
        continue;
      }
    }
  }

  return hits / tokensQuery.length;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const UMBRAL_BADGE  = 0.45;  // mínimo para mostrar badge en la lista
const UMBRAL_MODAL  = 0.35;  // mínimo para aparecer en el modal de coincidencias

export function usePSSExistentes() {
  const [pssExistentes, setPssExistentes] = useState([]);

  const cargarArchivo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array', codepage: 65001 });
      const sheet = workbook.Sheets['PSS-Intrack'] || workbook.Sheets[workbook.SheetNames[1]];
      if (!sheet) {
        alert('No se encontró la hoja "PSS-Intrack"');
        return;
      }
      const rows = XLSX.utils.sheet_to_json(sheet).map(fixRow);
      setPssExistentes(rows);
    };
    reader.readAsArrayBuffer(file);
  };

  // Índice pre-computado por semana — tokens calculados una sola vez al cargar
  const indicePorSemana = useMemo(() => {
    const idx = new Map();
    for (const pss of pssExistentes) {
      const semana = Number(pss.Semana || pss['3'] || 0);
      const shipment = pss.SHIPMENT || pss['1'];
      const sinShipment = !shipment || String(shipment).trim() === '';
      if (!sinShipment) continue;

      const descRaw = pss.Descripcion || pss['9'] || '';
      const entry = {
        ...pss,
        Codigo:       pss.Codigo || pss['2'] || '',
        Descripcion:  descRaw,
        Semana:       semana,
        IngresoJaula: pss['Ingreso a Jaula'] || pss['4'],
        _tokens:      tokenizar(descRaw),
      };

      if (!idx.has(semana)) idx.set(semana, []);
      idx.get(semana).push(entry);
    }
    return idx;
  }, [pssExistentes]);

  const obtenerPorSemanas = (semanaActual) => {
    if (!semanaActual) return [];
    const actual   = indicePorSemana.get(Number(semanaActual))     || [];
    const anterior = indicePorSemana.get(Number(semanaActual) - 1) || [];
    return [...actual, ...anterior];
  };

  const buscarCoincidencias = (descripcionBuscada, semanaActual) => {
    const pssDisponibles = obtenerPorSemanas(semanaActual);
    if (!descripcionBuscada || !pssDisponibles.length) return [];

    const tokensQuery = tokenizar(descripcionBuscada);
    if (!tokensQuery.length) return [];

    return pssDisponibles
      .map(pss => ({ ...pss, score: calcularScore(tokensQuery, pss._tokens) }))
      .filter(pss => pss.score > UMBRAL_MODAL)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  // Batch: calcula scores para todas las filas en una sola pasada
  const calcularScoresBatch = (filas, semanaFija) => {
    if (!pssExistentes.length || !filas.length) {
      return filas.map(r => ({ ...r, _matchScore: null }));
    }

    const pssCache = new Map();
    const getPss = (sem) => {
      if (!pssCache.has(sem)) pssCache.set(sem, obtenerPorSemanas(sem));
      return pssCache.get(sem);
    };

    return filas.map(row => {
      const sem = semanaFija || Number(row.Sem);
      const pssDisponibles = getPss(sem);
      if (!pssDisponibles.length) return { ...row, _matchScore: null };

      const tokensQuery = tokenizar(row.Descripciones);
      if (!tokensQuery.length) return { ...row, _matchScore: null };

      let mejor = 0;
      for (const pss of pssDisponibles) {
        const score = calcularScore(tokensQuery, pss._tokens);
        if (score > mejor) mejor = score;
        if (mejor >= 1) break;
      }

      return { ...row, _matchScore: mejor >= UMBRAL_BADGE ? mejor : null };
    });
  };

  return {
    pssExistentes,
    cargarArchivo,
    obtenerPorSemanas,
    buscarCoincidencias,
    calcularScoresBatch,
    hayDatos: pssExistentes.length > 0,
  };
}
