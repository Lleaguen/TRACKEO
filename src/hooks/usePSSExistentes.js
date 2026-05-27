import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { fixRow } from '../utils/fixEncoding';

// Pre-tokeniza una descripción en palabras útiles (>2 chars)
function tokenizar(desc) {
  return String(desc == null ? '' : desc).toLowerCase().split(/\s+/).filter(p => p.length > 2);
}

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

  // Índice pre-computado: Map<semana, PSS[]> — se recalcula solo cuando cambia pssExistentes
  const indicePorSemana = useMemo(() => {
    const idx = new Map();
    for (const pss of pssExistentes) {
      const semana = Number(pss.Semana || pss['3'] || 0);
      const shipment = pss.SHIPMENT || pss['1'];
      const sinShipment = !shipment || String(shipment).trim() === '';
      if (!sinShipment) continue;

      // Normalizar campos una sola vez
      const normalizado = {
        ...pss,
        Codigo: pss.Codigo || pss['2'] || '',
        Descripcion: pss.Descripcion || pss['9'] || '',
        Semana: semana,
        IngresoJaula: pss['Ingreso a Jaula'] || pss['4'],
        _tokens: tokenizar(pss.Descripcion || pss['9'] || ''),
      };

      if (!idx.has(semana)) idx.set(semana, []);
      idx.get(semana).push(normalizado);
    }
    return idx;
  }, [pssExistentes]);

  // Obtener PSS disponibles para una semana (actual + anterior)
  const obtenerPorSemanas = (semanaActual) => {
    if (!semanaActual) return [];
    const actual = indicePorSemana.get(Number(semanaActual)) || [];
    const anterior = indicePorSemana.get(Number(semanaActual) - 1) || [];
    return [...actual, ...anterior];
  };

  // Calcula score entre tokens de búsqueda y tokens pre-computados del PSS
  const calcularScore = (tokensQuery, tokensPss) => {
    if (!tokensQuery.length || !tokensPss.length) return 0;
    let hits = 0;
    for (const t of tokensQuery) {
      if (tokensPss.some(tp => tp.includes(t) || t.includes(tp))) hits++;
    }
    return hits / tokensQuery.length;
  };

  const buscarCoincidencias = (descripcionBuscada, semanaActual) => {
    const pssDisponibles = obtenerPorSemanas(semanaActual);
    if (!descripcionBuscada || !pssDisponibles.length) return [];

    const tokensQuery = tokenizar(descripcionBuscada);

    return pssDisponibles
      .map(pss => {
        const score = calcularScore(tokensQuery, pss._tokens);
        return { ...pss, score };
      })
      .filter(pss => pss.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  // Calcula scores para un batch de filas de una vez — mucho más eficiente que llamar
  // obtenerMejorMatch fila por fila porque reutiliza el mismo array de PSS disponibles
  const calcularScoresBatch = (filas, semanaFija) => {
    if (!pssExistentes.length || !filas.length) {
      return filas.map(r => ({ ...r, _matchScore: null }));
    }

    // Agrupar filas por semana para no recalcular obtenerPorSemanas N veces
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
        if (mejor >= 1) break; // no puede mejorar
      }

      return { ...row, _matchScore: mejor > 0.3 ? mejor : null };
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
