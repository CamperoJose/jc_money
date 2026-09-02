// Cliente del Servicio Web de Indicadores del Banco Central de Bolivia (BCB).
// SOAP 1.1. Documentado en "Especificaciones Técnicas del Servicio Web de
// Indicadores del BCB" v3.
//
// Método:  obtenerIndicador(codIndicador, codMoneda, fecha "dd/mm/aaaa")
// Devuelve (tipos de cambio): codError, desIndicador, codMoneda, fecha, valor.
//
// Este módulo es PURO (sin imports del alias @/) para poder testearlo con
// `node --experimental-strip-types`. La llamada de red usa un `fetch` inyectable.

export const BCB_ENDPOINT = "https://indicadores.bcb.gob.bo/ServiciosBCB/indicadores";
export const BCB_WSDL_URL = `${BCB_ENDPOINT}?wsdl`;

/**
 * targetNamespace del servicio (SIN barra final), confirmado por un cliente en
 * producción que consume el mismo WS. No hace falta leer el WSDL.
 */
export const BCB_NAMESPACE = "http://ws.bcb.gob.bo";

/** Códigos de tipo de indicador (codificador N°1 del BCB). */
export const BCB_INDICADORES = [
  { cod: 1, desc: "Tipo de cambio" },
  { cod: 2, desc: "Tasa de Interés de Referencia (TRE)" },
  { cod: 3, desc: "Tasa activa de paridad referencial (UFV)" },
] as const;

/**
 * Códigos de moneda del BCB relevantes para la app. IMPORTANTE: el dólar
 * estadounidense (venta) que devuelve el WS es el código **12** (así lo usa un
 * cliente en producción; "Ecuador – Dólar" es el dólar de EE.UU.). Los códigos
 * 34/35 del documento devuelven "moneda inválida" (CodError 1003) en el WS.
 */
export const BCB_MONEDAS = [
  { cod: 12, desc: "EE.UU. – Dólar (venta)" },
  { cod: 76, desc: "Unidad de Fomento de Vivienda (UFV)" },
  { cod: 53, desc: "Unión Europea – Euro" },
  { cod: 69, desc: "Bolivianos" },
  { cod: 75, desc: "MVDOL" },
  { cod: 34, desc: "EE.UU. – Dólar compra (doc; puede dar 1003)" },
  { cod: 35, desc: "EE.UU. – Dólar venta (doc; puede dar 1003)" },
  { cod: 340, desc: "EE.UU. – Dólar referencial compra" },
  { cod: 350, desc: "EE.UU. – Dólar referencial venta" },
] as const;

/** Mensajes de error del BCB (codificador N°3). */
export const BCB_ERRORES: Record<string, string> = {
  "0": "Consulta con éxito",
  "1001": "Alguno de los parámetros está vacío",
  "1002": "Código de tipo de indicador no válido",
  "1003": "Código de moneda no válido",
  "1004": "Fecha inválida",
  "2001": "No existe valor para los parámetros",
  "2002": "Error interno en el BCB",
};

export function descripcionMoneda(cod: number): string {
  return BCB_MONEDAS.find((m) => m.cod === cod)?.desc ?? `Moneda ${cod}`;
}

export interface RespuestaBCB {
  codError: string;
  desIndicador: string | null;
  codMoneda: number | null;
  fecha: string | null;
  valor: number | null;
}

/** "YYYY-MM-DD" → "dd/mm/aaaa" (formato que exige el BCB). */
export function fechaISOaConsulta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Nombres de parámetro del método (confirmados por un cliente en producción). */
export const PARAM_NAMES_DEFAULT = ["codIndicador", "codMoneda", "fecha"] as const;

/** Extrae el targetNamespace del WSDL (utilidad; el cliente no lo necesita). */
export function extraerTargetNamespace(wsdl: string): string | null {
  const m = wsdl.match(/targetNamespace\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * Descubre los nombres de los 3 parámetros de `obtenerIndicador` a partir del
 * WSDL/XSD (JAX-WS a veces los expone como arg0/arg1/arg2 en vez de los nombres
 * del documento). Devuelve null si no logra determinarlos.
 */
export function descubrirParamNames(wsdl: string): string[] | null {
  // Busca el complexType asociado al request (por nombre) o el element inline.
  const ct = wsdl.match(
    /<(?:\w+:)?complexType[^>]*\bname="obtenerIndicador"[^>]*>([\s\S]*?)<\/(?:\w+:)?complexType>/i
  );
  let bloque = ct?.[1] ?? null;
  if (!bloque) {
    const el = wsdl.match(
      /<(?:\w+:)?element[^>]*\bname="obtenerIndicador"[^>]*>([\s\S]*?)<\/(?:\w+:)?element>/i
    );
    bloque = el?.[1] ?? null;
  }
  if (!bloque) return null;
  const nombres = [...bloque.matchAll(/<(?:\w+:)?element[^>]*\bname="([^"]+)"/gi)].map((m) => m[1]);
  return nombres.length >= 3 ? nombres.slice(0, 3) : null;
}

/** Construye el sobre SOAP 1.1 para obtenerIndicador con nombres de param dados. */
export function construirEnvelope(
  namespace: string,
  paramNames: readonly string[],
  valores: [number | string, number | string, string]
): string {
  const [p1, p2, p3] = paramNames;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="${namespace}">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<web:obtenerIndicador>` +
    `<${p1}>${valores[0]}</${p1}>` +
    `<${p2}>${valores[1]}</${p2}>` +
    `<${p3}>${valores[2]}</${p3}>` +
    `</web:obtenerIndicador>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}

/** Extrae el contenido del primer tag `nombre` (ignora prefijos de namespace). */
function tag(xml: string, nombre: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${nombre}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nombre}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function aNumero(s: string | null): number | null {
  if (s == null || s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parsea la respuesta SOAP/XML del método obtenerIndicador.
 *
 * El BCB responde una LISTA de pares:
 *   <return><codDato>CodError</codDato><dato>0</dato></return>
 *   <return><codDato>Valor</codDato><dato>6.96</dato></return> …
 * Se soporta ese formato (primario) y, como respaldo, el formato plano del
 * documento (<codError>…</codError><valor>…</valor>). Tolerante a prefijos.
 */
export function parseRespuestaBCB(xml: string): RespuestaBCB {
  const bloques = [...xml.matchAll(/<(?:\w+:)?return\b[^>]*>([\s\S]*?)<\/(?:\w+:)?return>/gi)];
  const mapa = new Map<string, string>();
  for (const b of bloques) {
    const nombre = tag(b[1], "codDato");
    if (nombre == null) continue;
    mapa.set(nombre.trim().toLowerCase(), (tag(b[1], "dato") ?? "").trim());
  }

  if (mapa.size > 0) {
    const codError = mapa.get("coderror") ?? "";
    let valor = aNumero(mapa.get("valor") ?? null);
    // Respaldo: si no hay clave "valor" pero la consulta fue exitosa, toma el
    // primer par numérico que no sea un campo meta conocido.
    if (valor == null && codError === "0") {
      const meta = new Set(["coderror", "codmoneda", "codindicador"]);
      for (const [k, v] of mapa) {
        if (meta.has(k)) continue;
        const n = aNumero(v);
        if (n != null) {
          valor = n;
          break;
        }
      }
    }
    return {
      codError,
      desIndicador: mapa.get("descripcion") ?? mapa.get("desindicador") ?? null,
      codMoneda: aNumero(mapa.get("codmoneda") ?? null),
      fecha: mapa.get("fecha") ?? null,
      valor,
    };
  }

  // Formato plano (respaldo).
  return {
    codError: tag(xml, "codError") ?? "",
    desIndicador: tag(xml, "desIndicador"),
    codMoneda: aNumero(tag(xml, "codMoneda")),
    fecha: tag(xml, "fecha"),
    valor: aNumero(tag(xml, "valor")),
  };
}

export interface ConsultaBCB {
  codIndicador: number;
  codMoneda: number;
  fechaISO: string; // "YYYY-MM-DD"
  namespace?: string; // override; por defecto BCB_NAMESPACE
  paramNames?: string[]; // override; por defecto codIndicador/codMoneda/fecha
  soapAction?: string;
}

type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export interface DiagnosticoBCB {
  namespace: string;
  paramNames: string[];
  envelope: string;
  status: number;
  raw: string;
  parsed: RespuestaBCB;
}

/** Ejecuta la consulta al WS (namespace fijo, sin leer el WSDL). */
async function consultar(fetchImpl: FetchLike, consulta: ConsultaBCB): Promise<DiagnosticoBCB> {
  const namespace = consulta.namespace || BCB_NAMESPACE;
  const paramNames = consulta.paramNames?.length ? consulta.paramNames : [...PARAM_NAMES_DEFAULT];
  const fecha = fechaISOaConsulta(consulta.fechaISO);
  const envelope = construirEnvelope(namespace, paramNames, [
    consulta.codIndicador,
    consulta.codMoneda,
    fecha,
  ]);
  const res = await fetchImpl(BCB_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPAction: consulta.soapAction ?? "" },
    body: envelope,
  });
  const raw = await res.text();
  return { namespace, paramNames, envelope, status: res.status, raw, parsed: parseRespuestaBCB(raw) };
}

/**
 * Diagnóstico: ejecuta la consulta y devuelve el sobre enviado, el HTTP status,
 * el XML crudo y el parseo, sin lanzar. Para depurar el servicio en producción.
 */
export async function diagnosticarTipoCambioBCB(
  fetchImpl: FetchLike,
  consulta: ConsultaBCB
): Promise<{ namespace: string; intentos: DiagnosticoBCB[] }> {
  const d = await consultar(fetchImpl, consulta);
  return { namespace: d.namespace, intentos: [d] };
}

/**
 * Consulta el T/C al BCB (namespace y parámetros fijos, confirmados por un
 * cliente en producción). Lanza Error claro ante HTTP != 2xx, codError != 0, o
 * si no llega un valor.
 */
export async function obtenerTipoCambioBCB(
  fetchImpl: FetchLike,
  consulta: ConsultaBCB
): Promise<RespuestaBCB> {
  const d = await consultar(fetchImpl, consulta);
  if (d.status < 200 || d.status >= 300) {
    throw new Error(`El servicio del BCB respondió HTTP ${d.status}.`);
  }
  const r = d.parsed;
  if (r.codError && r.codError !== "0") {
    throw new Error(`BCB codError ${r.codError}: ${BCB_ERRORES[r.codError] ?? "error desconocido"}`);
  }
  if (r.valor == null) {
    throw new Error(`La respuesta del BCB no incluyó un valor. Fragmento: ${d.raw.slice(0, 300)}`);
  }
  return r;
}
