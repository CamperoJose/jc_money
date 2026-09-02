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

/** Códigos de tipo de indicador (codificador N°1 del BCB). */
export const BCB_INDICADORES = [
  { cod: 1, desc: "Tipo de cambio" },
  { cod: 2, desc: "Tasa de Interés de Referencia (TRE)" },
  { cod: 3, desc: "Tasa activa de paridad referencial (UFV)" },
] as const;

/** Códigos de moneda (codificador N°2 del BCB) relevantes para la app. */
export const BCB_MONEDAS = [
  { cod: 34, desc: "EE.UU. – Dólar (compra)" },
  { cod: 35, desc: "EE.UU. – Dólar (venta)" },
  { cod: 340, desc: "EE.UU. – Dólar referencial (compra)" },
  { cod: 350, desc: "EE.UU. – Dólar referencial (venta)" },
  { cod: 53, desc: "Unión Europea – Euro" },
  { cod: 69, desc: "Bolivianos" },
  { cod: 75, desc: "MVDOL" },
  { cod: 76, desc: "Unidad de Fomento de Vivienda (UFV)" },
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

/** Nombres de parámetro por defecto del método (según el documento del BCB). */
export const PARAM_NAMES_DEFAULT = ["codIndicador", "codMoneda", "fecha"] as const;

/** Extrae el targetNamespace del WSDL. */
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
 * Parsea la respuesta SOAP/XML del método obtenerIndicador. Tolerante a
 * prefijos de namespace y a que venga envuelta en un Envelope o suelta.
 */
export function parseRespuestaBCB(xml: string): RespuestaBCB {
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
  namespace?: string; // si no se da, se descubre del WSDL
  paramNames?: string[]; // si no se da, se descubre del WSDL (o default)
  soapAction?: string;
}

type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/** Resuelve namespace y nombres de parámetro (del WSDL si hace falta). */
async function resolverServicio(
  fetchImpl: FetchLike,
  consulta: ConsultaBCB
): Promise<{ namespace: string; paramNames: string[] }> {
  let namespace = consulta.namespace;
  let paramNames = consulta.paramNames;
  if (!namespace || !paramNames) {
    const wsdlRes = await fetchImpl(BCB_WSDL_URL, { method: "GET" });
    if (!wsdlRes.ok) throw new Error(`No se pudo leer el WSDL del BCB (HTTP ${wsdlRes.status}).`);
    const wsdl = await wsdlRes.text();
    namespace = namespace ?? extraerTargetNamespace(wsdl) ?? undefined;
    paramNames = paramNames ?? descubrirParamNames(wsdl) ?? [...PARAM_NAMES_DEFAULT];
  }
  if (!namespace) throw new Error("No se pudo determinar el namespace del servicio BCB.");
  return { namespace, paramNames: paramNames ?? [...PARAM_NAMES_DEFAULT] };
}

export interface DiagnosticoBCB {
  namespace: string;
  paramNames: string[];
  envelope: string;
  status: number;
  raw: string;
  parsed: RespuestaBCB;
}

/**
 * Ejecuta la consulta y devuelve TODO (sobre enviado, HTTP status, XML crudo y
 * parseo) sin lanzar por codError. Útil para diagnosticar el servicio en prod.
 */
export async function diagnosticarTipoCambioBCB(
  fetchImpl: FetchLike,
  consulta: ConsultaBCB
): Promise<DiagnosticoBCB> {
  const { namespace, paramNames } = await resolverServicio(fetchImpl, consulta);
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
 * Consulta el T/C al BCB. Descubre namespace y nombres de parámetro del WSDL si
 * no se proveen, arma el sobre SOAP, hace el POST y parsea la respuesta.
 * Lanza Error con mensaje claro ante fallos de red o codError != 0.
 */
export async function obtenerTipoCambioBCB(
  fetchImpl: FetchLike,
  consulta: ConsultaBCB
): Promise<RespuestaBCB> {
  const d = await diagnosticarTipoCambioBCB(fetchImpl, consulta);
  if (d.status < 200 || d.status >= 300) {
    throw new Error(`El servicio del BCB respondió HTTP ${d.status}.`);
  }
  const r = d.parsed;
  if (r.codError && r.codError !== "0") {
    throw new Error(`BCB codError ${r.codError}: ${BCB_ERRORES[r.codError] ?? "error desconocido"}`);
  }
  if (r.valor == null) {
    throw new Error(
      `La respuesta del BCB no incluyó un valor. Revisa el formato (namespace ${d.namespace}, params ${d.paramNames.join("/")}). Fragmento: ${d.raw.slice(0, 300)}`
    );
  }
  return r;
}
