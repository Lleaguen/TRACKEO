import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
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

const RANGOS_PRECIO = [
  { label: 'Todos',        min: null,    max: null    },
  { label: '< $100k',     min: null,    max: 100000  },
  { label: '< $500k',     min: null,    max: 500000  },
  { label: '$500k – $1M', min: 500000,  max: 1000000 },
  { label: '> $1M',       min: 1000000, max: null    },
];

// Virtualización simple: ventana de WINDOW_SIZE items centrada en el foco
const WINDOW_SIZE = 60;

function formatPrecio(val) {
  if (val == null || val === '') return null;
  const n = Number(String(val).replace(/[^0-9.,]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function labelPrecio(val) {
  if (val == null) return null;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `$${Math.round(val / 1_000)}k`;
  return `$${val}`;
}

function matchColor(score) {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.5) return 'bg-yellow-400';
  return 'bg-orange-400';
}

// Fila memoizada — solo re-renderiza si sus props cambian
const FilaPendiente = memo(function FilaPendiente({ row, idx, isFocused, isSelected, onToggle, onClick }) {
  const precio = formatPrecio(row['$']);
  const score = row._matchScore;

  return (
    <div
      className={`flex items-start gap-3 py-2 px-1 rounded transition-colors ${
        isFocused ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(idx)}
        className="mt-1 accent-blue-600 cursor-pointer shrink-0"
      />
      <div className="flex-1 cursor-pointer min-w-0" onClick={() => onClick(row, idx)}>
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-sm text-gray-700 hover:text-blue-600 transition-colors flex-1 min-w-0">
            {row.Descripciones}
          </p>
          {precio != null && (
            <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              {labelPrecio(precio)}
            </span>
          )}
          {score != null && (
            <span className={`shrink-0 text-xs font-bold text-white px-2 py-0.5 rounded-full ${matchColor(score)}`}>
              {Math.round(score * 100)}% match
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          ID: {row.id}
          {row.Sem && <span className="ml-2 font-medium text-gray-500">· Sem {row.Sem}</span>}
          {row['Fecha Inhub'] && (
            <span className="ml-2">· Inhub: {XLSX.SSF.format('dd/mm/yyyy', row['Fecha Inhub'])}</span>
          )}
        </p>
      </div>
    </div>
  );
});

export default function App() {
  const { data, semanas, cargarArchivo } = useExcel();
  const { trackeados, agregar: agregarTrackeados, eliminar: eliminarTrackeado, limpiar: limpiarTracking } = useTracking();
  const { pssList, agregar: agregarPss, eliminar: eliminarPss, limpiar: limpiarPss } = usePSS();
  const { buscarCoincidencias, calcularScoresBatch, cargarArchivo: cargarPSSExistentes, hayDatos: hayPSSExistentes } = usePSSExistentes();

  const [semanaSeleccionada, setSemanaSeleccionada] = useState('');
  const [ultimas3, setUltimas3] = useState(false);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [tabActiva, setTabActiva] = useState('Búsqueda');
  const [modalPSS, setModalPSS] = useState(false);
  const [modalTrackear, setModalTrackear] = useState(null);
  const [modalCoincidencias, setModalCoincidencias] = useState(null);
  const [rangoPrecio, setRangoPrecio] = useState(0);
  const [ordenarPorMatch, setOrdenarPorMatch] = useState(true);
  const [filaFocused, setFilaFocused] = useState(0);
  const listaRef = useRef(null);

  const ultimas3Semanas = useMemo(() => semanas.slice(-3), [semanas]);

  const filasBase = useMemo(() => {
    if (ultimas3) {
      return data.filter(
        r => ultimas3Semanas.includes(Number(r.Sem)) &&
             String(r.Recupero).trim().toUpperCase() === 'NO'
      );
    }
    if (!semanaSeleccionada) return [];
    return data.filter(
      r => Number(r.Sem) === Number(semanaSeleccionada) &&
           String(r.Recupero).trim().toUpperCase() === 'NO'
    );
  }, [data, semanaSeleccionada, ultimas3, ultimas3Semanas]);

  const { filtrosActivos, setFiltrosActivos, limpiar: limpiarFiltros, hayFiltrosActivos,
          gruposFiltros, filasFiltradas, busqueda, setBusqueda } = useFiltros(filasBase);

  // Filtro de precio
  const filasConPrecio = useMemo(() => {
    const rango = RANGOS_PRECIO[rangoPrecio];
    if (rango.min == null && rango.max == null) return filasFiltradas;
    return filasFiltradas.filter(row => {
      const precio = formatPrecio(row['$']);
      if (precio == null) return false;
      if (rango.min != null && precio < rango.min) return false;
      if (rango.max != null && precio >= rango.max) return false;
      return true;
    });
  }, [filasFiltradas, rangoPrecio]);

  // Scores calculados en batch — una sola pasada para todas las filas
  const filasConScore = useMemo(() => {
    if (!hayPSSExistentes) return filasConPrecio.map(r => ({ ...r, _matchScore: null }));
    const semanaFija = ultimas3 ? null : (semanaSeleccionada ? Number(semanaSeleccionada) : null);
    return calcularScoresBatch(filasConPrecio, semanaFija);
  }, [filasConPrecio, hayPSSExistentes, calcularScoresBatch, ultimas3, semanaSeleccionada]);

  // Ordenar por match si está activado
  const filasOrdenadas = useMemo(() => {
    if (!ordenarPorMatch) return filasConScore;
    return [...filasConScore].sort((a, b) => (b._matchScore ?? -1) - (a._matchScore ?? -1));
  }, [filasConScore, ordenarPorMatch]);

  // Ventana virtual: solo renderizar WINDOW_SIZE filas alrededor del foco
  const { ventana, offsetTop } = useMemo(() => {
    const total = filasOrdenadas.length;
    if (total <= WINDOW_SIZE) return { ventana: filasOrdenadas.map((r, i) => ({ row: r, idx: i })), offsetTop: 0 };
    const start = Math.max(0, Math.min(filaFocused - Math.floor(WINDOW_SIZE / 2), total - WINDOW_SIZE));
    const end = Math.min(start + WINDOW_SIZE, total);
    return {
      ventana: filasOrdenadas.slice(start, end).map((r, i) => ({ row: r, idx: start + i })),
      offsetTop: start,
    };
  }, [filasOrdenadas, filaFocused]);

  // Scroll al item enfocado
  useEffect(() => {
    if (!listaRef.current) return;
    const localIdx = filaFocused - offsetTop;
    const el = listaRef.current.children[localIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [filaFocused, offsetTop]);

  // Teclado global
  useEffect(() => {
    const hayModal = modalPSS || modalTrackear || modalCoincidencias;
    const handler = (e) => {
      if (hayModal || tabActiva !== 'Búsqueda') return;
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFilaFocused(i => Math.min(i + 1, filasOrdenadas.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFilaFocused(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filasOrdenadas[filaFocused]) {
        e.preventDefault();
        handleClickPendiente(filasOrdenadas[filaFocused]);
      } else if (e.key === ' ') {
        e.preventDefault();
        toggleSeleccion(filaFocused);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabActiva, filasOrdenadas, filaFocused, modalPSS, modalTrackear, modalCoincidencias]);

  useEffect(() => { setFilaFocused(0); }, [filasOrdenadas.length, busqueda, rangoPrecio]);

  const toggleSeleccion = useCallback((idx) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const handleConfirmarTrackear = (pssAsignado) => {
    agregarTrackeados(modalTrackear, pssAsignado, agregarPss);
    setSeleccionados(new Set());
    setModalTrackear(null);
    setTabActiva('Tracking');
  };

  const handleClickPendiente = useCallback((item, idx) => {
    if (idx !== undefined) setFilaFocused(idx);
    if (!hayPSSExistentes) {
      alert('Primero cargá el archivo de PSS existentes');
      return;
    }
    const semanaItem = ultimas3 ? Number(item.Sem) : Number(semanaSeleccionada);
    const coincidencias = buscarCoincidencias(item.Descripciones, semanaItem);
    setModalCoincidencias({ item, coincidencias });
  }, [hayPSSExistentes, ultimas3, semanaSeleccionada, buscarCoincidencias]);

  const handleAsignarPSS = (pssSeleccionado) => {
    const { item } = modalCoincidencias;
    const codigoPSS = pssSeleccionado.Codigo;
    const numeroPSS = codigoPSS.replace('PSS', '');
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
    XLSX.writeFile(wb, `trackeo_sem${ultimas3 ? ultimas3Semanas.join('-') : (semanaSeleccionada || 'all')}.xlsx`);
  };

  const cantConMatch = useMemo(
    () => filasOrdenadas.filter(r => r._matchScore != null).length,
    [filasOrdenadas]
  );

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
          <div className="flex items-center gap-2">
            <select
              value={ultimas3 ? '' : semanaSeleccionada}
              onChange={e => {
                setUltimas3(false);
                setSemanaSeleccionada(e.target.value);
                limpiarFiltros();
                setSeleccionados(new Set());
              }}
              className="border rounded px-3 py-1.5 text-sm"
              disabled={ultimas3}
            >
              <option value="">-- Elegir semana --</option>
              {semanas.map(s => <option key={s} value={s}>Semana {s}</option>)}
            </select>
            <button
              onClick={() => {
                setUltimas3(prev => !prev);
                setSemanaSeleccionada('');
                limpiarFiltros();
                setSeleccionados(new Set());
              }}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                ultimas3
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              title={`Semanas ${ultimas3Semanas.join(', ')}`}
            >
              Últimas 3 semanas
              {ultimas3 && ultimas3Semanas.length > 0 && (
                <span className="ml-1 text-xs opacity-80">({ultimas3Semanas.join(', ')})</span>
              )}
            </button>
          </div>
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
      {tabActiva === 'Búsqueda' && (semanaSeleccionada || ultimas3) && (
        <div className="flex gap-4">
          {/* Panel de filtros */}
          <div className="w-56 shrink-0 bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700">Filtros</span>
              {(hayFiltrosActivos || rangoPrecio !== 0) && (
                <button
                  onClick={() => { limpiarFiltros(); setRangoPrecio(0); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Filtro de precio */}
            <div className="border-b pb-3 mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Precio ($)</p>
              <div className="space-y-1">
                {RANGOS_PRECIO.map((r, i) => (
                  <label key={i} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                    <input
                      type="radio"
                      name="rangoPrecio"
                      checked={rangoPrecio === i}
                      onChange={() => setRangoPrecio(i)}
                      className="accent-blue-600"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Ordenar por match */}
            {hayPSSExistentes && (
              <div className="border-b pb-3 mb-3">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                  <input
                    type="checkbox"
                    checked={ordenarPorMatch}
                    onChange={e => setOrdenarPorMatch(e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span className="font-semibold">Matches primero</span>
                </label>
                <p className="text-xs text-gray-400 mt-1 pl-5">Los que tienen PSS similar aparecen arriba</p>
              </div>
            )}

            <FiltrosGenericos grupos={gruposFiltros} filtrosActivos={filtrosActivos} onChange={setFiltrosActivos} />
          </div>

          {/* Lista de pendientes */}
          <div className="flex-1 bg-white rounded-2xl shadow p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">
                {filasOrdenadas.length} de {filasBase.length} resultados
                {hayPSSExistentes && cantConMatch > 0 && (
                  <span className="ml-2 text-xs text-green-600">· {cantConMatch} con match</span>
                )}
              </p>
              {seleccionados.size > 0 && (
                <button
                  onClick={() => setModalTrackear(filasOrdenadas.filter((_, i) => seleccionados.has(i)))}
                  className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-full hover:bg-blue-700"
                >
                  Trackear {seleccionados.size} seleccionado{seleccionados.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-300 mb-2">↑↓ navegar · Enter abrir · Espacio seleccionar</p>

            {/* Espaciador superior para simular scroll virtual */}
            <div className="overflow-y-auto flex-1">
              {offsetTop > 0 && (
                <div style={{ height: offsetTop * 52 }} aria-hidden="true" />
              )}
              <div className="divide-y" ref={listaRef}>
                {ventana.map(({ row, idx }) => (
                  <FilaPendiente
                    key={row.id ?? idx}
                    row={row}
                    idx={idx}
                    isFocused={idx === filaFocused}
                    isSelected={seleccionados.has(idx)}
                    onToggle={toggleSeleccion}
                    onClick={handleClickPendiente}
                  />
                ))}
              </div>
              {offsetTop + WINDOW_SIZE < filasOrdenadas.length && (
                <div style={{ height: (filasOrdenadas.length - offsetTop - WINDOW_SIZE) * 52 }} aria-hidden="true" />
              )}
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
