import { useState } from 'react';
import * as XLSX from 'xlsx';
import { fixRow } from '../utils/fixEncoding';

export function useExcel() {
  const [data, setData] = useState([]);
  const [semanas, setSemanas] = useState([]);

  const cargarArchivo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array', codepage: 65001 });
      const sheet = workbook.Sheets['General'] || workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet).map(fixRow);
      setData(rows);
      setSemanas([...new Set(rows.map(r => r.Sem).filter(Boolean))].sort((a, b) => a - b));
    };
    reader.readAsArrayBuffer(file);
  };

  return { data, semanas, cargarArchivo };
}
