import { useState } from 'react';

export default function ModalCoincidencias({ item, coincidencias, onAsignar, onCerrar }) {
  const [seleccionado, setSeleccionado] = useState(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <h2 className="text-base font-bold text-gray-800 mb-2">Posibles coincidencias PSS</h2>
        <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="font-medium">Item pendiente:</p>
          <p>{item.Descripciones}</p>
          <p className="text-xs text-gray-400 mt-1">ID: {item.id}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {coincidencias.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No se encontraron PSS similares para esta semana y la anterior
            </p>
          ) : (
            <div className="space-y-2">
              {coincidencias.map((pss, i) => (
                <div
                  key={i}
                  onClick={() => setSeleccionado(pss)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    seleccionado?.Codigo === pss.Codigo
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                          {pss.Codigo}
                        </span>
                        <span className="text-xs text-gray-400">Semana {pss.Semana}</span>
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
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