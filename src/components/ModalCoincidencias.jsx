import { useState, useEffect, useRef } from 'react';

export default function ModalCoincidencias({ item, coincidencias, onAsignar, onCerrar }) {
  const [idx, setIdx] = useState(0);
  const listRef = useRef(null);

  // Teclado: ESC cierra, flechas navegan, Enter asigna
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onCerrar(); return; }
      if (coincidencias.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIdx(i => Math.min(i + 1, coincidencias.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        onAsignar(coincidencias[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [coincidencias, idx, onAsignar, onCerrar]);

  // Scroll automático al item seleccionado
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[idx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const seleccionado = coincidencias[idx] ?? null;

  const matchColor = (score) => {
    if (score >= 0.8) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 0.5) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-orange-700 bg-orange-50 border-orange-200';
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-base font-bold text-gray-800">Posibles coincidencias PSS</h2>
          <span className="text-xs text-gray-400 mt-1">↑↓ navegar · Enter asignar · Esc cerrar</span>
        </div>

        <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="font-medium">Item pendiente:</p>
          <p>{item.Descripciones}</p>
          <p className="text-xs text-gray-400 mt-1">ID: {item.id}</p>
        </div>

        <div className="flex-1 overflow-y-auto" ref={listRef}>
          {coincidencias.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No se encontraron PSS similares para esta semana y la anterior
            </p>
          ) : (
            <div className="space-y-2">
              {coincidencias.map((pss, i) => (
                <div
                  key={i}
                  onClick={() => setIdx(i)}
                  onDoubleClick={() => onAsignar(pss)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    i === idx
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-mono text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                          {pss.Codigo}
                        </span>
                        <span className="text-xs text-gray-400">Semana {pss.Semana}</span>
                        {pss.IngresoJaula && (
                          <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                            Ingreso: {typeof pss.IngresoJaula === 'number'
                              ? new Date((pss.IngresoJaula - 25569) * 86400 * 1000).toLocaleDateString('es-AR')
                              : pss.IngresoJaula}
                          </span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${matchColor(pss.score)}`}>
                          {Math.round(pss.score * 100)}% match
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{pss.Descripcion}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
          <button onClick={onCerrar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
          <button
            onClick={() => seleccionado && onAsignar(seleccionado)}
            disabled={!seleccionado}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40"
          >
            Asignar PSS
          </button>
        </div>
      </div>
    </div>
  );
}
