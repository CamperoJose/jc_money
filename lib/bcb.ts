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

/** Extrae el targetNamespace del WSDL. */
export function extraerTargetNamespace(wsdl: string): string | null {
  const m = wsdl.match(/targetNamespace\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/** Construye el sobre SOAP 1.1 para obtenerIndicador. */
export function construirEnvelope(
  namespace: string,
  codIndicador: number,
  codMoneda: number,
  fechaDDMMYYYY: string
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="${namespace}">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<web:obtenerIndicador>` +
    `<codIndicador>${codIndicador}</codIndicador>` +
    `<codMoneda>${codMoneda}</codMoneda>` +
    `<fecha>${fechaDDMMYYYY}</fecha>` +
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
  soapAction?: string;
}

type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/**
 * Consulta el T/C al BCB. Descubre el targetNamespace del WSDL si no se
 * provee, arma el sobre SOAP, hace el POST y parsea la respuesta.
 * Lanza Error con mensaje claro ante fallos de red o codError != 0.
 */
export async function obtenerTipoCambioBCB(
  fetchImpl: FetchLike,
  consulta: ConsultaBCB
): Promise<RespuestaBCB> {
  let namespace = consulta.namespace;
  if (!namespace) {
    const wsdlRes = await fetchImpl(BCB_WSDL_URL, { method: "GET" });
    if (!wsdlRes.ok) throw new Error(`No se pudo leer el WSDL del BCB (HTTP ${wsdlRes.status}).`);
    const wsdl = await wsdlRes.text();
    namespace = extraerTargetNamespace(wsdl) ?? undefined;
    if (!namespace) throw new Error("No se pudo determinar el namespace del servicio BCB.");
  }

  const fecha = fechaISOaConsulta(consulta.fechaISO);
  const envelope = construirEnvelope(namespace, consulta.codIndicador, consulta.codMoneda, fecha);

  const res = await fetchImpl(BCB_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=UTF-8",
      SOAPAction: consulta.soapAction ?? "",
    },
    body: envelope,
  });
  if (!res.ok) throw new Error(`El servicio del BCB respondió HTTP ${res.status}.`);
  const xml = await res.text();
  const r = parseRespuestaBCB(xml);

  if (r.codError && r.codError !== "0") {
    throw new Error(`BCB codError ${r.codError}: ${BCB_ERRORES[r.codError] ?? "error desconocido"}`);
  }
  if (r.valor == null) {
    throw new Error("La respuesta del BCB no incluyó un valor de tipo de cambio.");
  }
  return r;
}
