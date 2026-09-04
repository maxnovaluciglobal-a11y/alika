/**
 * Parser del CSV de importación del arancel (G-4).
 *
 * Vive fuera del archivo de ruta para poder probarlo sin montar la pantalla:
 * es la parte del módulo con más casos borde y la que decide si la migración
 * de un cliente entra bien o entra mal.
 *
 * Deliberadamente sin librería de CSV. Lo que tiene que aguantar no es CSV
 * arbitrario sino lo que exporta una planilla real: separador `,` o `;` (Excel
 * en español usa `;`), comillas dobles con escape doblado, y montos escritos
 * como "$45.000" o "45.000,50".
 */

export interface ArancelCsvRow {
  name: string;
  code: string;
  category: string;
  /** Unidades que ve el usuario, NO cents. Convertir con `toCents(_, moneda)`. */
  price: number;
  /** Unidades visibles, no cents. */
  referencePrice: number | null;
  /** Unidades visibles, no cents. */
  labCost: number | null;
  durationMin: number | null;
  allowsDiscount: boolean;
}

export interface ArancelCsvResult {
  filas: ArancelCsvRow[];
  errores: string[];
}

/** Minúsculas sin acentos, para comparar encabezados venga como venga. */
function normalizar(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      // Rango de marcas diacríticas combinantes. Escapado explícito a
      // propósito: escribir los caracteres literales deja bytes invisibles en
      // el fuente que nadie puede revisar en un diff.
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  );
}

/**
 * Divide una línea respetando comillas. `""` dentro de un campo entrecomillado
 * es una comilla literal, que es como Excel escapa.
 */
function partirLinea(linea: string, sep: string): string[] {
  const out: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === sep && !entreComillas) {
      out.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  out.push(actual);
  return out.map((v) => v.trim());
}

/**
 * "$45.000" → 45000. "45.000,50" → 45000.5. Vacío → `null`, que no es lo
 * mismo que cero (regla 11): una prestación sin costo de laboratorio cargado
 * no tiene costo cero, no tiene dato.
 *
 * Devuelve la UNIDAD QUE VE EL USUARIO, no cents, y por eso no redondea.
 * Antes hacía `Math.round` argumentando la regla 6, y eso solo era correcto
 * en CLP: en una clínica en MXN, "45.000,50" tiene que terminar en 4500050
 * cents, no en 45001. Quién convierte —y con qué moneda— es el llamador, vía
 * `toCents`, que ya redondea al entero final.
 */
export function parsearMonto(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const limpio = v.replace(/[^\d.,-]/g, "");
  if (!limpio || limpio === "-") return null;
  // Si termina en coma + 1-2 dígitos, esa coma es el decimal (formato es-CL);
  // en cualquier otro caso los puntos y comas son separadores de miles.
  const usaComaDecimal = /,\d{1,2}$/.test(limpio);
  const n = Number(
    usaComaDecimal ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/[.,]/g, ""),
  );
  return Number.isFinite(n) ? n : null;
}

export function parseArancelCsv(texto: string): ArancelCsvResult {
  const lineas = texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim());
  if (!lineas.length) return { filas: [], errores: ["El archivo está vacío."] };

  // El separador se decide por la línea de encabezado: la que más tiene, gana.
  const puntoYComa = lineas[0].split(";").length - 1;
  const comas = lineas[0].split(",").length - 1;
  const sep = puntoYComa > comas ? ";" : ",";

  const cabecera = partirLinea(lineas[0], sep).map(normalizar);
  const columna = (...alias: string[]) => cabecera.findIndex((h) => alias.includes(h));

  const iNombre = columna("nombre", "prestacion", "descripcion", "name", "producto");
  if (iNombre < 0) {
    return {
      filas: [],
      errores: ['El CSV necesita una columna "Nombre" (o "Prestación" / "Descripción").'],
    };
  }

  const iCodigo = columna("codigo", "code", "id");
  const iCategoria = columna("categoria", "category", "rubro", "especialidad");
  const iPrecio = columna("precio", "precio final", "valor", "price", "monto");
  const iRef = columna("valor referencial", "precio referencial", "v.r.", "vr", "referencial");
  const iLab = columna("costo laboratorio", "laboratorio", "lab", "costo lab");
  const iDur = columna("duracion", "duracion (min)", "minutos", "min");
  const iDescuento = columna("permite descuento", "descuento", "acepta descuento");

  const filas: ArancelCsvRow[] = [];
  const errores: string[] = [];

  for (let i = 1; i < lineas.length; i++) {
    const celdas = partirLinea(lineas[i], sep);
    const name = celdas[iNombre]?.trim();
    if (!name) {
      errores.push(`Fila ${i + 1}: sin nombre, se omite.`);
      continue;
    }

    filas.push({
      name,
      code: iCodigo >= 0 ? (celdas[iCodigo] ?? "") : "",
      category: iCategoria >= 0 ? (celdas[iCategoria] ?? "") : "",
      // El precio SÍ cae a 0 si falta: una prestación tiene que tener precio
      // para poder presupuestarse, y 0 es visible y corregible en la tabla.
      price: (iPrecio >= 0 ? parsearMonto(celdas[iPrecio]) : null) ?? 0,
      referencePrice: iRef >= 0 ? parsearMonto(celdas[iRef]) : null,
      labCost: iLab >= 0 ? parsearMonto(celdas[iLab]) : null,
      durationMin: iDur >= 0 ? parsearMonto(celdas[iDur]) : null,
      allowsDiscount:
        iDescuento >= 0
          ? !["no", "false", "0", "n"].includes(normalizar(celdas[iDescuento] ?? "si"))
          : true,
    });
  }

  return { filas, errores };
}
