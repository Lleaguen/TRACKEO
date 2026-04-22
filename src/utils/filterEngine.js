const PATTERNS = {
  peso: /\b(\d+(?:[.,]\d+)?\s*(?:kg|gr|g(?=\s)|mg|lb|lbs|kilos?))\b/gi,
  capacidad: /\b(\d+\s*(?:gb|tb|mb|mah))\b/gi,
  talle: /\b(talle\s*\w+|xs|xxl|xxxl|xl\b|(?<!\w)[sml](?!\w)|\d{2,3}\s*cm|\d+\/\d+)\b/gi,
  rodado: /\b(r\d{2}|rodado\s*\d+|\d{2}[""]|\d{2}x\d+)\b/gi,
  color: /\b(negro|negra|blanco|blanca|rojo|roja|azul|verde|amarillo|amarilla|gris|plateado|plateada|dorado|dorada|rosa|naranja|violeta|celeste|marron|beige|transparente)\b/gi,
  unidades: /\b(x\s*\d+|\d+\s*unidades?|\d+\s*pares?|\d+\s*pack)\b/gi,
};

const MARCAS = [
  'apple','samsung','xiaomi','motorola','lg','sony','hp','dell','lenovo','asus',
  'huawei','oppo','realme','philips','whirlpool','electrolux','bosch','ariston',
  'nike','adidas','puma','reebok','fila','topper','lacoste','levis','zara',
  'pampers','huggies','johnson','dove','nivea','loreal','garnier','pantene',
  'purina','pedigree','whiskas','hills','eukanuba',
  'stanley','tramontina','bahco','makita','dewalt','truper',
  'bic','faber','pilot','stabilo','artline','canon','epson','brother',
  'tupperware','tefal','imusa','peabody','atma','drean','gafa','longvie',
  'redmi','poco','realme','tcl','hisense',
];

// Categorías con keywords de frase completa (orden: más específico primero)
const CATEGORIAS = [
  ['Mascotas', [
    'para perro','para gato','para mascotas','canino','felino',
    'pedigree','whiskas','royal canin','eukanuba','hills science',
    'collar para','correa para','arena para gato','alimento balanceado',
    'antipulgas','antiparasitario','rascador','arenero','hueso para',
    'snack para perro','snack para gato',
  ]],
  ['Electrónica', [
    'iphone','smartphone','celular','tablet','notebook','laptop',
    'computadora','monitor ','teclado','mouse ','auricular','parlante',
    'smartwatch','camara digital','cargador usb','power bank',
    'disco rigido','memoria ram','procesador','placa de video',
    'redmi watch','galaxy watch','apple watch','smart tv',
    'malla para','correa para reloj','correa para watch',
  ]],
  ['Ropa y calzado', [
    'remera','pantalon','short ','campera','buzo ','zapatilla',
    'zapato','sandalia','bota ','calza ','vestido','pollera',
    'medias ','jean ','camiseta','ropa de','talle ',
  ]],
  ['Alimentos', [
    'yerba mate','mate cocido','cafe molido','te verde','te negro',
    'arroz largo','fideos ','aceite de','azucar ','harina ','leche en',
    'chocolate ','galleta','snack ','proteina en polvo',
    'barra de cereal','granola','avena ',
  ]],
  ['Herramientas', [
    'taladro','sierra ','llave inglesa','destornillador','martillo',
    'pinza ','alicate','cinta metrica','tornillo','clavo ',
    'tuerca','amoladora','soldadora','compresor','nivel laser',
  ]],
  ['Construcción', [
    'membrana','impermeabilizante','cemento','pintura para','sellador',
    'masilla','porcelanato','ceramica','mosaico','perfil de aluminio',
    'caño ','tuberia','grifo','canilla','llave de paso',
  ]],
  ['Hogar y muebles', [
    'silla ','mesa ','lampara','cortina','almohada','sabana',
    'toalla','colchon','mueble','estante','repisa','organizador',
    'cesto ','balde ','escoba','trapo de','vajilla','cubiertos',
    'olla ','sarten','cafetera','licuadora','batidora',
  ]],
  ['Salud y belleza', [
    'crema hidratante','shampoo','acondicionador','jabon liquido',
    'desodorante','perfume','maquillaje','vitamina ','curita',
    'venda ','alcohol en gel','barbijo','termometro',
    'menopausia','colageno','omega','probiotico',
  ]],
  ['Deportes', [
    'bicicleta','bici ','pelota de','raqueta','guante de','casco ',
    'rodillera','pesas ','mancuerna','colchoneta yoga','fitness',
  ]],
  ['Automotor', [
    'para auto','para moto','para camion','parabrisas',
    'espejo retrovisor','filtro de aceite','bujia','amortiguador',
    'llanta','neumatico','bateria para auto','alarma para',
    'ventilete','vidrio ventilete',
  ]],
  ['Juguetes', [
    'juguete','muñeca','auto a escala','lego','puzzle','rompecabezas',
    'peluche','juego de mesa','didactico',
  ]],
  ['Librería y oficina', [
    'lapiz','boligrafo','cuaderno','carpeta','resma','marcador ',
    'tijera','regla ','compas ','goma de borrar','cartuchera',
  ]],
];

// Qué filtros secundarios mostrar según categoría seleccionada
export const FILTROS_SECUNDARIOS_POR_CATEGORIA = {
  'Deportes': ['rodado', 'talle', 'marca', 'color'],
  'Ropa y calzado': ['talle', 'color', 'marca'],
  'Electrónica': ['marca', 'capacidad', 'color'],
  'Mascotas': ['peso', 'marca'],
  'Alimentos': ['peso', 'unidades', 'marca'],
  'Herramientas': ['marca', 'unidades'],
  'Construcción': ['peso', 'color', 'unidades'],
  'Hogar y muebles': ['color', 'marca', 'unidades'],
  'Salud y belleza': ['marca', 'unidades'],
  'Automotor': ['color', 'marca'],
  'Juguetes': ['marca', 'unidades'],
  'Librería y oficina': ['marca', 'unidades', 'color'],
};

function normalizar(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectarCategoria(desc) {
  const d = normalizar(desc);
  for (const [cat, keywords] of CATEGORIAS) {
    if (keywords.some(k => d.includes(normalizar(k)))) return cat;
  }
  return null;
}

export function tokenizar(descripcion) {
  const desc = normalizar(descripcion);
  const tokens = {};

  const cat = detectarCategoria(descripcion);
  if (cat) tokens.categoria = cat;

  const marcaEncontrada = MARCAS.find(m => new RegExp(`\\b${m}\\b`, 'i').test(desc));
  if (marcaEncontrada) {
    tokens.marca = marcaEncontrada.charAt(0).toUpperCase() + marcaEncontrada.slice(1);
  }

  for (const [key, regex] of Object.entries(PATTERNS)) {
    regex.lastIndex = 0;
    const match = regex.exec(desc);
    if (match) tokens[key] = match[1].trim().toLowerCase();
  }

  return tokens;
}

export function generarFiltros(descripciones) {
  const grupos = {};
  for (const desc of descripciones) {
    const tokens = tokenizar(desc);
    for (const [key, val] of Object.entries(tokens)) {
      if (!grupos[key]) grupos[key] = new Set();
      grupos[key].add(val);
    }
  }
  return Object.fromEntries(
    Object.entries(grupos)
      .filter(([, vals]) => vals.size > 1)
      .map(([k, v]) => [k, [...v].sort()])
  );
}

export function aplicarFiltros(descripciones, filtrosActivos) {
  const activos = Object.entries(filtrosActivos).filter(([, v]) => v.length > 0);
  if (activos.length === 0) return descripciones;
  return descripciones.filter(desc => {
    const tokens = tokenizar(desc);
    return activos.every(([key, vals]) => vals.includes(tokens[key]));
  });
}

export const LABEL_MAP = {
  categoria: 'Categoría',
  marca: 'Marca',
  peso: 'Peso',
  capacidad: 'Capacidad',
  talle: 'Talle',
  rodado: 'Rodado',
  color: 'Color',
  unidades: 'Unidades',
};
