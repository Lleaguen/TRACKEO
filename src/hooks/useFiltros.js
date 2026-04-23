import { useState, useMemo } from 'react';
import { generarFiltros, aplicarFiltros } from '../utils/filterEngine';

export function useFiltros(filasBase) {
  const [filtrosActivos, setFiltrosActivos] = useState({});
  const [busqueda, setBusqueda] = useState('');

  const descripciones = useMemo(
    () => filasBase.map(r => r.Descripciones).filter(Boolean),
    [filasBase]
  );

  const gruposCategorias = useMemo(() => {
    const { categoria } = generarFiltros(descripciones);
    return categoria ? { categoria } : {};
  }, [descripciones]);

  const categoriasActivas = filtrosActivos['categoria'] || [];

  const descripcionesPorCategoria = useMemo(() => {
    if (!categoriasActivas.length) return [];
    return descripciones.filter(d => aplicarFiltros([d], { categoria: categoriasActivas }).length > 0);
  }, [descripciones, categoriasActivas]);

  const gruposSecundarios = useMemo(() => {
    if (!descripcionesPorCategoria.length) return {};
    const { categoria: _, ...resto } = generarFiltros(descripcionesPorCategoria);
    return resto;
  }, [descripcionesPorCategoria]);

  const gruposFiltros = useMemo(
    () => ({ ...gruposCategorias, ...gruposSecundarios }),
    [gruposCategorias, gruposSecundarios]
  );

  const filasFiltradas = useMemo(() => {
    const activos = Object.entries(filtrosActivos).filter(([, v]) => v.length > 0);
    let resultado = activos.length
      ? filasBase.filter(row => aplicarFiltros([row.Descripciones || ''], filtrosActivos).length > 0)
      : filasBase;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      resultado = resultado.filter(row => (row.Descripciones || '').toLowerCase().includes(q));
    }

    return resultado;
  }, [filasBase, filtrosActivos, busqueda]);

  const limpiar = () => setFiltrosActivos({});
  const hayFiltrosActivos = Object.values(filtrosActivos).some(v => v.length > 0);

  return {
    filtrosActivos, setFiltrosActivos, limpiar, hayFiltrosActivos,
    gruposFiltros, filasFiltradas,
    busqueda, setBusqueda,
  };
}
