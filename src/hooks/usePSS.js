import { useState } from 'react';

export function usePSS() {
  const [pssList, setPssList] = useState([]);

  const agregar = (pss) => {
    if (Array.isArray(pss)) {
      setPssList(prev => [...prev, ...pss]);
    } else {
      setPssList(prev => [...prev, { id: Date.now(), ...pss }]);
    }
  };

  const eliminar = (id) => setPssList(prev => prev.filter(p => p.id !== id));
  const limpiar = () => setPssList([]);

  return { pssList, agregar, eliminar, limpiar };
}
