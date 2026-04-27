import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { fixRow } from '../utils/fixEncoding';

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
      console.log('PSS-Intrack primera fila:', rows[0]);
      console.log('Columnas disponibles:', Object.keys(rows[0] || {}));
      console.log('Ejemplo de datos:');
      console.log('- Codigo (col 2):', rows[0]?.Codigo || rows[0]?.['2']);
      console.log('- Semana (col 3):', rows[0]?.Semana || rows[0]?.['3']);
      console.log('- Ingreso a Jaula (col 4):', rows[0]?.['Ingreso a Jaula'] || rows[0]?.['4']);
      console.log('- Descripcion (col 9):', rows[0]?.Descripcion || rows[0]?.['9']);
      console.log('- SHIPMENT (col 1):', rows[0]?.SHIPMENT || rows[0]?.['1']);
      setPssExistentes(rows);
    };
    reader.readAsArrayBuffer(file);
  };

  const obtenerPorSemanas = (semanaActual) => {
    if (!semanaActual || !pssExistentes.length) return [];
    const semanaAnterior = semanaActual - 1;
    // Usar los nombres correctos de las columnas y filtrar PSS sin shipment
    return pssExistentes.filter(pss => {
      const semanaPss = pss.Semana || pss['3']; // Columna 3 = Semana
      const shipment = pss.SHIPMENT || pss['1']; // Columna 1 = SHIPMENT
      
      // Solo PSS sin shipment asignado (columna B vacía) y de semana actual/anterior
      const sinShipment = !shipment || shipment.toString().trim() === '';
      const semanaValida = !semanaPss || Number(semanaPss) === semanaActual || Number(semanaPss) === semanaAnterior;
      
      return sinShipment && semanaValida;
    });
  };

  const buscarCoincidencias = (descripcionBuscada, semanaActual) => {
    const pssDisponibles = obtenerPorSemanas(semanaActual);
    if (!descripcionBuscada || !pssDisponibles.length) return [];

    const palabras = descripcionBuscada.toLowerCase().split(' ').filter(p => p.length > 2);
    
    return pssDisponibles
      .map(pss => {
        // Usar los nombres correctos de las columnas del archivo PSS-Intrack
        const descPss = (pss.Descripcion || pss['9'] || '').toLowerCase(); // Columna 9 = Descripcion
        const codigoPss = pss.Codigo || pss['2'] || ''; // Columna 2 = Codigo
        const semanaPss = pss.Semana || pss['3'] || semanaActual; // Columna 3 = Semana
        const ingresoJaula = pss['Ingreso a Jaula'] || pss['4']; // Columna 4 = Ingreso a Jaula
        const coincidencias = palabras.filter(palabra => descPss.includes(palabra)).length;
        const score = coincidencias / palabras.length;
        return { 
          ...pss, 
          score,
          Codigo: codigoPss, // Columna 2
          Descripcion: pss.Descripcion || pss['9'] || '', // Columna 9
          Semana: semanaPss, // Columna 3
          IngresoJaula: ingresoJaula // Columna 4 - Fecha de ingreso
        };
      })
      .filter(pss => pss.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  return { 
    pssExistentes, 
    cargarArchivo, 
    obtenerPorSemanas, 
    buscarCoincidencias,
    hayDatos: pssExistentes.length > 0 
  };
}