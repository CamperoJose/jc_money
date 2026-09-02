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

/** Nombres alternativos (JAX-WS sin @WebParam los expone como arg0/arg1/arg2). */
export const PARAM_NAMES_ALT = ["arg0", "arg1", "arg2"] as const;

/** codError que sugieren un problema de binding de parámetros (no de negocio). */
const CODERROR_BINDING = new Set(["1001", "1002", "1003"]);

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

/** Ejecuta UNA consulta con namespace y nombres de parámetro dados. */
async function intentarConsulta(
  fetchImpl: FetchLike,
  namespace: string,
  paramNames: string[],
  consulta: ConsultaBCB
): Promise<DiagnosticoBCB> {
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

/** Convenciones de nombres de parámetro a probar (primaria + arg0/arg1/arg2). */
function convenciones(primary: string[]): string[][] {
  const lista = [primary, [...PARAM_NAMES_ALT]];
  const vistos = new Set<string>();
  return lista.filter((c) => {
    const k = c.join("|");
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/**
 * Diagnóstico: prueba las convenciones de nombres de parámetro y devuelve TODOS
 * los intentos (sobre, status, XML crudo, parseo) sin lanzar. Para depurar prod.
 */
export async function diagnosticarTipoCambioBCB(
  fetchImpl: FetchLike,
  consulta: ConsultaBCB
): Promise<{ namespace: string; intentos: DiagnosticoBCB[] }> {
  const { namespace, paramNames } = await resolverServicio(fetchImpl, consulta);
  const intentos: DiagnosticoBCB[] = [];
  for (const nombres of convenciones(paramNames)) {
    intentos.push(await intentarConsulta(fetchImpl, namespace, nombres, consulta));
  }
  return { namespace, intentos };
}

/**
 * Consulta el T/C al BCB. Descubre namespace del WSDL si no se provee y prueba
 * las convenciones de nombres de parámetro (codIndicador/… y arg0/arg1/arg2),
 * devolviendo el primer intento exitoso. Lanza Error claro si ninguno funciona.
 */
export async function obtenerTipoCambioBCB(
  fetchImpl: FetchLike,
  consulta: ConsultaBCB
): Promise<RespuestaBCB> {
  const { namespace, paramNames } = await resolverServicio(fetchImpl, consulta);
  let ultimo: DiagnosticoBCB | null = null;

  for (const nombres of convenciones(paramNames)) {
    const d = await intentarConsulta(fetchImpl, namespace, nombres, consulta);
    ultimo = d;
    if (d.status < 200 || d.status >= 300) continue;
    const r = d.parsed;
    if (r.codError === "0" && r.valor != null) return r;
    // Si el error NO es de binding, no tiene sentido reintentar con otros nombres.
    if (r.codError && !CODERROR_BINDING.has(r.codError)) {
      throw new Error(`BCB codError ${r.codError}: ${BCB_ERRORES[r.codError] ?? "error desconocido"}`);
    }
  }

  if (ultimo && (ultimo.status < 200 || ultimo.status >= 300)) {
    throw new Error(`El servicio del BCB respondió HTTP ${ultimo.status}.`);
  }
  const r = ultimo?.parsed;
  if (r?.codError && r.codError !== "0") {
    throw new Error(`BCB codError ${r.codError}: ${BCB_ERRORES[r.codError] ?? "error desconocido"}`);
  }
  throw new Error(
    `La respuesta del BCB no incluyó un valor. namespace ${namespace}, params probados. Fragmento: ${ultimo?.raw.slice(0, 300) ?? ""}`
  );
}
