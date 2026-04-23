import { useState } from 'react';
import Barcode from './Barcode';

export default function ModalPSS({ onGuardar, onCerrar }) {
  const [numero, setNumero] = useState('');
  const [desc, setDesc] = useState('');
  const codigo = numero ? `PSS${numero}` : '';
  const valido = numero && desc.trim();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-base font-bold text-gray-800 mb-4">Registrar Pieza Sin Shipment</h2>

        <label className="block text-sm text-gray-600 mb-1">Número PSS</label>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-orange-500">PSS</span>
          <input
            autoFocus
            type="text"
            value={numero}
            onChange={e => setNumero(e.target.value.replace(/\D/g, ''))}
            placeholder="333333"
            className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {codigo && (
          <div className="flex justify-center mb-3 p-2 bg-gray-50 rounded-lg">
            <Barcode value={codigo} />
          </div>
        )}

        <label className="block text-sm text-gray-600 mb-1">Descripción</label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Descripción de la pieza..."
          className="w-full border rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCerrar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
          <button
            onClick={() => valido && onGuardar({ numero, codigo, descripcion: desc.trim() })}
            disabled={!valido}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-40"
          >
            Registrar PSS
          </button>
        </div>
      </div>
    </div>
  );
}
