import { useState } from 'react';

export default function ModalTrackear({ items, onConfirmar, onCerrar }) {
  const [pssAsignado, setPssAsignado] = useState({});

  const setPss = (idx, numero) => {
    setPssAsignado(prev => ({
      ...prev,
      [idx]: numero ? { numero, codigo: `PSS${numero}` } : null,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
        <h2 className="text-base font-bold text-gray-800 mb-1">Confirmar Tracking</h2>
        <p className="text-xs text-gray-400 mb-4">Podés asignar un código PSS a cada item (opcional)</p>

        <div className="overflow-y-auto flex-1 divide-y">
          {items.map((row, idx) => (
            <div key={idx} className="py-3">
              <p className="text-sm text-gray-700 mb-1">{row.Descripciones}</p>
              <p className="text-xs text-gray-400 mb-2">ID: {row.id}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-orange-500">PSS</span>
                <input
                  type="text"
                  placeholder="Número PSS (opcional)"
                  onChange={e => setPss(idx, e.target.value.replace(/\D/g, ''))}
                  className="border rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                {pssAsignado[idx]?.codigo && (
                  <span className="text-xs text-orange-500 font-mono">{pssAsignado[idx].codigo}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
          <button onClick={onCerrar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(pssAsignado)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700"
          >
            Trackear {items.length} item{items.length > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
