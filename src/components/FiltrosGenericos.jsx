import { useState } from 'react';
import { LABEL_MAP, FILTROS_SECUNDARIOS_POR_CATEGORIA } from '../utils/filterEngine';

function GrupoFiltro({ label, valores, seleccionados, onChange }) {
  const [abierto, setAbierto] = useState(true);

  const toggle = (valor) => {
    const nuevos = seleccionados.includes(valor)
      ? seleccionados.filter(v => v !== valor)
      : [...seleccionados, valor];
    onChange(nuevos);
  };

  return (
    <div className="border-b pb-3 mb-3">
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 mb-2"
      >
        <span>{label}</span>
        <span className="text-gray-400">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div className="space-y-1">
          {valores.map(valor => (
            <label key={valor} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
              <input
                type="checkbox"
                checked={seleccionados.includes(valor)}
                onChange={() => toggle(valor)}
                className="accent-blue-600"
              />
              {valor}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function FiltrosGenericos({ grupos, filtrosActivos, onChange }) {
  const categoriasSeleccionadas = filtrosActivos['categoria'] || [];

  // Determinar qué filtros secundarios mostrar según categorías activas
  const filtrosSecundariosVisibles = new Set();
  for (const cat of categoriasSeleccionadas) {
    const secundarios = FILTROS_SECUNDARIOS_POR_CATEGORIA[cat] || [];
    secundarios.forEach(f => filtrosSecundariosVisibles.add(f));
  }

  // Si no hay categoría seleccionada, no mostrar secundarios
  const gruposAMostrar = Object.entries(grupos).filter(([key]) => {
    if (key === 'categoria') return true;
    return filtrosSecundariosVisibles.has(key);
  });

  if (gruposAMostrar.length === 0) return null;

  return (
    <div>
      {gruposAMostrar.map(([key, valores]) => (
        <GrupoFiltro
          key={key}
          label={LABEL_MAP[key] || key}
          valores={valores}
          seleccionados={filtrosActivos[key] || []}
          onChange={(nuevos) => onChange({ ...filtrosActivos, [key]: nuevos })}
        />
      ))}
    </div>
  );
}

export default FiltrosGenericos;
