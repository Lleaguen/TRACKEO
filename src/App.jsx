import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

import { useExcel } from './hooks/useExcel';
import { useTracking } from './hooks/useTracking';
import { usePSS } from './hooks/usePSS';
import { usePSSExistentes } from './hooks/usePSSExistentes';
import { useFiltros } from './hooks/useFiltros';

import FiltrosGenericos from './components/FiltrosGenericos';
import Barcode from './components/Barcode';
import ModalPSS from './components/ModalPSS';
import ModalTrackear from './components/ModalTrackear';
import ModalCoincidencias from './components/ModalCoincidencias';

const TABS = ['Búsqueda', 'Tracking', 'PSS'];

export default function App() {
  const { data, semanas, cargarArchivo } = useExcel();
  const { trackeados, agregar: agregarTrackeados, eliminar: eliminarTrackeado, limpiar: limpiarTracking } = useTracking();
  const { pssList, agregar: agregarPss, eliminar: eliminarPss, limpiar: limpiarPss } = usePSS();
  const { buscarCoincidencias, cargarArchivo: cargarPSSExistentes, hayDatos: hayPSSExistentes } = usePSSExistentes();

  const [semanaSeleccionada, setSemanaSeleccionada] = useState('');
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [tabActiva, setTabActiva] = useState('Búsqueda');
  const [modalPSS, setModalPSS] = useState(false);
  const [modalTrackear, setModalTrackear] = useState(null);
  const [modalCoincidencias, setModalCoincidencias] = useState(null);

  const filasBase = useMemo(() => data.filter(
    r => Number(r.Sem) === Number(semanaSeleccionada) &&
         String(r.Recupero).trim().toUpperCase() === 'NO'
  ), [data, semanaSeleccionada]);

  const { filtrosActivos, setFiltrosActivos, limpiar: limpiarFiltros, hayFiltrosActivos,
          gruposFiltros, filasFiltradas, busqueda, setBusqueda } = useFiltros(filasBase);

  const toggleSeleccion = (idx) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleConfirmarTrackear = (pssAsignado) => {
    agregarTrackeados(modalTrackear, pssAsignado, agregarPss);
    setSeleccionados(new Set());
    setModalTrackear(null);
    setTabActiva('Tracking');
  };

  const handleClickPendiente = (item) => {
    if (!hayPSSExistentes) {
      alert('Primero cargá el archivo de PSS existentes');
      return;
    }
    const coincidencias = buscarCoincidencias(item.Descripciones, Number(semanaSeleccionada));
    setModalCoincidencias({ item, coincidencias });
  };

  const handleAsignarPSS = (pssSeleccionado) => {
    const { item } = modalCoincidencias;
    // Usar el código PSS completo (ej: PSS123456)
    const codigoPSS = pssSeleccionado.Codigo;
    const numeroPSS = codigoPSS.replace('PSS', '');
    
    // Agregar a tracking con PSS asignado
    agregarTrackeados([item], { 0: { numero: numeroPSS, codigo: codigoPSS } }, agregarPss);
    setModalCoincidencias(null);
    setTabActiva('Tracking');
  };

  const handleExportar = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      trackeados.map(r => ({ 'Shipment ID': r.id, 'Descripción': r.Descripciones, 'Semana': r.Sem, 'PSS': r.pss?.codigo || '' }))
    ), 'Tracking');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      pssList.map(p => ({ 'Código PSS': p.codigo, 'Descripción': p.descripcion }))
    ), 'PSS');
    XLSX.writeFile(wb, `trackeo_sem${semanaSeleccionada || 'all'}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {modalPSS && (
        <ModalPSS
          onGuardar={(pss) => { agregarPss(pss); setModalPSS(false); setTabActiva('PSS'); }}
          onCerrar={() => setModalPSS(false)}
        />
      )}
      {modalTrackear && (
        <ModalTrackear
          items={modalTrackear}
          onConfirmar={handleConfirmarTrackear}
          onCerrar={() => setModalTrackear(null)}
        />
      )}
      {modalCoincidencias && (
        <ModalCoincidencias
          item={modalCoincidencias.item}
          coincidencias={modalCoincidencias.coincidencias}
          onAsignar={handleAsignarPSS}
          onCerrar={() => setModalCoincidencias(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-lg font-bold text-gray-800">Trackeo</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Excel principal:</label>
          <input type="file" accept=".xlsx,.xls,.xlsb" onChange={e => cargarArchivo(e.target.files[0])} className="text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">PSS existentes:</label>
          <input type="file" accept=".xlsx,.xls,.xlsb" onChange={e => cargarPSSExistentes(e.target.files[0])} className="text-sm" />
          {hayPSSExistentes && <span className="text-xs text-green-600">✓</span>}
        </div>
        {semanas.length > 0 && (
          <select
            value={semanaSeleccionada}
            onChange={e => { setSemanaSeleccionada(e.target.value); limpiarFiltros(); setSeleccionados(new Set()); }}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="">-- Elegir semana --</option>
            {semanas.map(s => <option key={s} value={s}>Semana {s}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setModalPSS(true)} className="bg-orange-500 text-white text-sm px-4 py-1.5 rounded-full hover:bg-orange-600">
            + PSS
          </button>
          {(trackeados.length > 0 || pssList.length > 0) && (
            <button onClick={handleExportar} className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-full hover:bg-green-700">
              Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
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
        <div className="ml-auto relative">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar descripción..."
            className="border rounded-full px-4 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>
      </div>

      {/* Tab: Búsqueda */}
      {tabActiva === 'Búsqueda' && semanaSeleccionada && (
        <div className="flex gap-4">
          <div className="w-56 shrink-0 bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700">Filtros</span>
              {hayFiltrosActivos && (
                <button onClick={limpiarFiltros} className="text-xs text-red-500 hover:underline">Limpiar</button>
              )}
            </div>
            <FiltrosGenericos grupos={gruposFiltros} filtrosActivos={filtrosActivos} onChange={setFiltrosActivos} />
          </div>

          <div className="flex-1 bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{filasFiltradas.length} de {filasBase.length} resultados</p>
              {seleccionados.size > 0 && (
                <button
                  onClick={() => setModalTrackear(filasFiltradas.filter((_, i) => seleccionados.has(i)))}
                  className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-full hover:bg-blue-700"
                >
                  Trackear {seleccionados.size} seleccionado{seleccionados.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
            <div className="divide-y">
              {filasFiltradas.map((row, i) => (
                <div key={i} className="flex items-start gap-3 py-2 px-1 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(i)}
                    onChange={() => toggleSeleccion(i)}
                    className="mt-1 accent-blue-600 cursor-pointer shrink-0"
                  />
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleClickPendiente(row)}
                  >
                    <p className="text-sm text-gray-700 hover:text-blue-600 transition-colors">{row.Descripciones}</p>
                    <p className="text-xs text-gray-400">
                      ID: {row.id}
                      {row['Fecha Inhub'] && (
                        <span className="ml-2">· Inhub: {XLSX.SSF.format('dd/mm/yyyy', row['Fecha Inhub'])}</span>
                      )}
                      {hayPSSExistentes && <span className="ml-2 text-blue-500">· Click para buscar PSS</span>}
                    </p>
                  </div>
                </div>
              ))}
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
              <button onClick={limpiarTracking} className="text-xs text-red-500 hover:underline">Limpiar todo</button>
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
                  <th className="pb-2 font-medium">PSS</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {trackeados.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{row.id}</td>
                    <td className="py-2 text-gray-700">{row.Descripciones}</td>
                    <td className="py-2">
                      {row.pss
                        ? <span className="text-xs font-mono text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{row.pss.codigo}</span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                    <td className="py-2 pl-4">
                      <button onClick={() => eliminarTrackeado(row.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
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
              <button onClick={limpiarPss} className="text-xs text-red-500 hover:underline">Limpiar todo</button>
            )}
          </div>
          {pssList.length === 0 ? (
            <p className="text-sm text-gray-400">No hay PSS registradas aún.</p>
          ) : (
            <div className="divide-y">
              {pssList.map(pss => (
                <div key={pss.id} className="flex items-start justify-between py-4 gap-4">
                  <div className="flex-1">
                    <div className="mb-2"><Barcode value={pss.codigo} /></div>
                    <p className="text-sm text-gray-700">{pss.descripcion}</p>
                  </div>
                  <button onClick={() => eliminarPss(pss.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
