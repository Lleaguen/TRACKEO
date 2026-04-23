import { useState } from 'react';

export function useTracking() {
  const [trackeados, setTrackeados] = useState([]);

  const agregar = (items, pssAsignado, onNuevasPss) => {
    const nuevosTrackeados = [];
    const nuevasPss = [];

    items.forEach((row, idx) => {
      const pss = pssAsignado[idx] || null;
      nuevosTrackeados.push({ ...row, pss });
      if (pss) {
        nuevasPss.push({
          id: Date.now() + idx,
          numero: pss.numero,
          codigo: pss.codigo,
          descripcion: row.Descripciones,
        });
      }
    });

    setTrackeados(prev => {
      const existentes = new Set(prev.map(t => t.id));
      return [...prev, ...nuevosTrackeados.filter(n => !existentes.has(n.id))];
    });

    if (nuevasPss.length > 0) onNuevasPss(nuevasPss);
  };

  const eliminar = (id) => setTrackeados(prev => prev.filter(t => t.id !== id));
  const limpiar = () => setTrackeados([]);

  return { trackeados, agregar, eliminar, limpiar };
}
