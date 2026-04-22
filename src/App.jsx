import { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import { generarFiltros, aplicarFiltros } from './utils/filterEngine';
import FiltrosGenericos from './components/FiltrosGenericos';

const TABS = ['Búsqueda', 'Tracking', 'PSS'];

function Barcode({ value }) {
  const svgRef = useRef(null);
  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 12,
      });
    }
  }, [value]);
  return <svg ref={svgRef} />;
}

function ModalPSS({ onGuardar, onCerrar }) {
  const [numero, setNumero] = useState('');
  const [desc, setDesc] = useState('');
  const codigo = numero ? `PSS${numero}` : '';

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
            onClick={() => numero && desc.trim() && onGuardar({ numero, codigo, descripcion: desc.trim() })}
            disabled={!numero || !desc.trim()}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-40"
          >
            Registrar PSS
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState('');
  const [filtrosActivos, setFiltrosActivos] = useState({});
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [trackeados, setTrackeados] = useState([]);
  const [pssList, setPssList] = useState([]);
  const [tabActiva, setTabActiva] = useState('Búsqueda');
  const [modalPSS, setModalPSS] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      const workSheet = workbook.Sheets['General'] || workbook.Sheets[workbook.SheetNames[0]];
      const fileData = XLSX.utils.sheet_to_json(workSheet);
      setData(fileData);
      const semanasUnicas = [...new Set(fileData.map(r => r.Sem).filter(Boolean))].sort((a, b) => a - b);
      setSemanas(semanasUnicas);
      setSemanaSeleccionada('');
      setFiltrosActivos({});
      setSeleccionados(new Set());
    };
    reader.readAsBinaryString(file);
  };

  const filasBase = useMemo(() => data.filter(
    r => Number(r.Sem) === Number(semanaSeleccionada) &&
         String(r.Recupero).trim().toUpperCase() === 'NO'
  ), [data, semanaSeleccionada]);

  const descripciones = useMemo(() => filasBase.map(r => r.Descripciones).filter(Boolean), [filasBase]);
  const gruposFiltros = useMemo(() => generarFiltros(descripciones), [descripciones]);

  const filasFiltradas = useMemo(() => {
    const activos = Object.entries(filtrosActivos).filter(([, v]) => v.length > 0);
    if (activos.length === 0) return filasBase;
    return filasBase.filter(row => aplicarFiltros([row.Descripciones || ''], filtrosActivos).length > 0);
  }, [filasBase, filtrosActivos]);

  const toggleSeleccion = (idx) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleTrackear = () => {
    const nuevos = filasFiltradas.filter((_, idx) => seleccionados.has(idx));
    setTrackeados(prev => {
      const existentes = new Set(prev.map(t => t.id));
      return [...prev, ...nuevos.filter(n => !existentes.has(n.id))];
    });
    setSeleccionados(new Set());
    setTabActiva('Tracking');
  };

  const handleGuardarPSS = ({ numero, codigo, descripcion }) => {
    setPssList(prev => [...prev, { id: Date.now(), numero, codigo, descripcion }]);
    setModalPSS(false);
    setTabActiva('PSS');
  };

  const handleExportar = () => {
    const wb = XLSX.utils.book_new();

    // Hoja Tracking
    const trackingData = trackeados.map(r => ({
      'Shipment ID': r.id,
      'Descripción': r.Descripciones,
      'Semana': r.Sem,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trackingData), 'Tracking');

    // Hoja PSS
    const pssData = pssList.map(p => ({
      'Código PSS': p.codigo,
      'Descripción': p.descripcion,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pssData), 'PSS');

    XLSX.writeFile(wb, `trackeo_sem${semanaSeleccionada || 'all'}.xlsx`);
  };

  const hayFiltrosActivos = Object.values(filtrosActivos).some(v => v.length > 0);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {modalPSS && <ModalPSS onGuardar={handleGuardarPSS} onCerrar={() => setModalPSS(false)} />}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-lg font-bold text-gray-800">Proyecto React Excel</h1>
        <input type="file" accept=".xlsx,.xls,.xlsb" onChange={handleFileUpload} className="text-sm" />
        {semanas.length > 0 && (
          <select
            value={semanaSeleccionada}
            onChange={e => { setSemanaSeleccionada(e.target.value); setFiltrosActivos({}); setSeleccionados(new Set()); }}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="">-- Elegir semana --</option>
            {semanas.map((s, i) => <option key={i} value={s}>Semana {s}</option>)}
          </select>
        )}
        <button
          onClick={() => setModalPSS(true)}
          className="bg-orange-500 text-white text-sm px-4 py-1.5 rounded-full hover:bg-orange-600"
        >
          + PSS
        </button>
        {(trackeados.length > 0 || pssList.length > 0) && (
          <button
            onClick={handleExportar}
            className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-full hover:bg-green-700"
          >
            Exportar Excel
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tabActiva === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow hover:bg-gray-50'
            }`}
          >
            {tab}
            {tab === 'Tracking' && trackeados.length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs">{trackeados.length}</span>
            )}
            {tab === 'PSS' && pssList.length > 0 && (
              <span className="ml-2 bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 text-xs">{pssList.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Búsqueda */}
      {tabActiva === 'Búsqueda' && semanaSeleccionada && (
        <div className="flex gap-4">
          <div className="w-56 shrink-0 bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700">Filtros</span>
              {hayFiltrosActivos && (
                <button onClick={() => setFiltrosActivos({})} className="text-xs text-red-500 hover:underline">Limpiar</button>
              )}
            </div>
            <FiltrosGenericos grupos={gruposFiltros} filtrosActivos={filtrosActivos} onChange={setFiltrosActivos} />
          </div>

          <div className="flex-1 bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{filasFiltradas.length} de {filasBase.length} resultados</p>
              {seleccionados.size > 0 && (
                <button
                  onClick={handleTrackear}
                  className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-full hover:bg-blue-700"
                >
                  Trackear {seleccionados.size} seleccionado{seleccionados.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
            <div className="divide-y">
              {filasFiltradas.map((row, i) => {
                const checked = seleccionados.has(i);
                return (
                  <div key={i} className="flex items-start gap-3 py-2 px-1 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSeleccion(i)}
                      className="mt-1 accent-blue-600 cursor-pointer shrink-0"
                    />
                    <div>
                      <p className="text-sm text-gray-700">{row.Descripciones}</p>
                      <p className="text-xs text-gray-400">ID: {row.id}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Tracking */}
      {tabActiva === 'Tracking' && (
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-700">Items en seguimiento</h2>
            {trackeados.length > 0 && (
              <button onClick={() => setTrackeados([])} className="text-xs text-red-500 hover:underline">Limpiar todo</button>
            )}
          </div>
          {trackeados.length === 0 ? (
            <p className="text-sm text-gray-400">No hay items trackeados aún.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-4 font-medium">Shipment ID</th>
                  <th className="pb-2 font-medium">Descripción</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {trackeados.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{row.id}</td>
                    <td className="py-2 text-gray-700">{row.Descripciones}</td>
                    <td className="py-2 pl-4">
                      <button
                        onClick={() => setTrackeados(prev => prev.filter(t => t.id !== row.id))}
                        className="text-xs text-red-400 hover:text-red-600"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: PSS */}
      {tabActiva === 'PSS' && (
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-700">Piezas Sin Shipment</h2>
            {pssList.length > 0 && (
              <button onClick={() => setPssList([])} className="text-xs text-red-500 hover:underline">Limpiar todo</button>
            )}
          </div>
          {pssList.length === 0 ? (
            <p className="text-sm text-gray-400">No hay PSS registradas aún.</p>
          ) : (
            <div className="divide-y">
              {pssList.map((pss) => (
                <div key={pss.id} className="flex items-start justify-between py-4 gap-4">
                  <div className="flex-1">
                    <div className="mb-2">
                      <Barcode value={pss.codigo} />
                    </div>
                    <p className="text-sm text-gray-700">{pss.descripcion}</p>
                  </div>
                  <button
                    onClick={() => setPssList(prev => prev.filter(p => p.id !== pss.id))}
                    className="text-xs text-red-400 hover:text-red-600 shrink-0"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
