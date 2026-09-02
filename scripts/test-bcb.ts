// Tests del cliente BCB (funciones puras). Ejecutar con:
//   node --experimental-strip-types scripts/test-bcb.ts
// No requiere red: usa un fetch simulado con las respuestas de ejemplo del doc.

import {
  fechaISOaConsulta,
  extraerTargetNamespace,
  construirEnvelope,
  parseRespuestaBCB,
  obtenerTipoCambioBCB,
} from "../lib/bcb.ts";

let fallos = 0;
function chk(nombre: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ok  - ${nombre}`);
  } else {
    fallos++;
    console.error(`  FAIL - ${nombre}`, extra ?? "");
  }
}

// 1) Formato de fecha
chk("fechaISOaConsulta 2026-09-02 → 02/09/2026", fechaISOaConsulta("2026-09-02") === "02/09/2026");

// 2) targetNamespace del WSDL
const wsdlFake = `<?xml version="1.0"?><wsdl:definitions targetNamespace="http://webservices.bcb.gob.bo/" xmlns:wsdl="...">`;
chk(
  "extraerTargetNamespace",
  extraerTargetNamespace(wsdlFake) === "http://webservices.bcb.gob.bo/",
  extraerTargetNamespace(wsdlFake)
);

// 3) Envelope contiene los parámetros
const env = construirEnvelope("http://webservices.bcb.gob.bo/", 1, 35, "02/09/2026");
chk("envelope tiene obtenerIndicador", env.includes("obtenerIndicador"));
chk("envelope tiene codIndicador 1", env.includes("<codIndicador>1</codIndicador>"));
chk("envelope tiene codMoneda 35", env.includes("<codMoneda>35</codMoneda>"));
chk("envelope tiene fecha", env.includes("<fecha>02/09/2026</fecha>"));
chk("envelope declara namespace", env.includes('xmlns:web="http://webservices.bcb.gob.bo/"'));

// 4) Parseo de la respuesta de ejemplo del documento (5.2.2.1), con prefijos SOAP.
const soapOk = `<?xml version="1.0" encoding="ISO-8859-1"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
 <soap:Body>
  <ns2:obtenerIndicadorResponse xmlns:ns2="http://webservices.bcb.gob.bo/">
   <return>
     <codError>0</codError>
     <desIndicador>Tipos de Cambio</desIndicador>
     <codMoneda>35</codMoneda>
     <fecha>02/09/2026</fecha>
     <valor>6.96000</valor>
   </return>
  </ns2:obtenerIndicadorResponse>
 </soap:Body>
</soap:Envelope>`;
const p = parseRespuestaBCB(soapOk);
chk("parse codError 0", p.codError === "0", p.codError);
chk("parse valor 6.96", p.valor === 6.96, p.valor);
chk("parse codMoneda 35", p.codMoneda === 35, p.codMoneda);
chk("parse fecha", p.fecha === "02/09/2026", p.fecha);
chk("parse desIndicador", p.desIndicador === "Tipos de Cambio", p.desIndicador);

// 5) Valor con coma decimal
chk("parse valor con coma", parseRespuestaBCB("<valor>6,96</valor>").valor === 6.96);

// 6) Respuesta de error (codError != 0) → parse lo refleja
const soapErr = `<indicador><tipoCambio><codError>2001</codError></tipoCambio></indicador>`;
chk("parse error 2001", parseRespuestaBCB(soapErr).codError === "2001");

// 7) Orquestación con fetch simulado (descubre namespace + POST)
async function testOrquestacion() {
  const llamadas: string[] = [];
  const fakeFetch = async (url: string, init?: { method?: string; body?: string }) => {
    llamadas.push(`${init?.method ?? "GET"} ${url}`);
    if (url.endsWith("?wsdl")) {
      return { ok: true, status: 200, text: async () => wsdlFake };
    }
    // valida que el body tenga el envelope
    chk("orquestación: POST lleva envelope", (init?.body ?? "").includes("obtenerIndicador"));
    return { ok: true, status: 200, text: async () => soapOk };
  };
  const r = await obtenerTipoCambioBCB(fakeFetch, { codIndicador: 1, codMoneda: 35, fechaISO: "2026-09-02" });
  chk("orquestación: valor 6.96", r.valor === 6.96, r.valor);
  chk("orquestación: hizo GET wsdl + POST", llamadas.length === 2, llamadas);
}

// 8) Orquestación con namespace provisto (no descubre WSDL)
async function testNamespaceProvisto() {
  let getWsdl = false;
  const fakeFetch = async (url: string) => {
    if (url.endsWith("?wsdl")) getWsdl = true;
    return { ok: true, status: 200, text: async () => soapOk };
  };
  await obtenerTipoCambioBCB(fakeFetch, {
    codIndicador: 1,
    codMoneda: 35,
    fechaISO: "2026-09-02",
    namespace: "http://webservices.bcb.gob.bo/",
  });
  chk("con namespace provisto NO consulta el WSDL", getWsdl === false);
}

// 9) Error del BCB lanza excepción
async function testErrorLanza() {
  const fakeFetch = async () => ({ ok: true, status: 200, text: async () => soapErr });
  let lanzo = false;
  try {
    await obtenerTipoCambioBCB(fakeFetch, {
      codIndicador: 1,
      codMoneda: 35,
      fechaISO: "2026-09-02",
      namespace: "x",
    });
  } catch {
    lanzo = true;
  }
  chk("codError 2001 lanza excepción", lanzo);
}

await testOrquestacion();
await testNamespaceProvisto();
await testErrorLanza();

if (fallos > 0) {
  console.error(`\n${fallos} test(s) fallaron.`);
  process.exit(1);
} else {
  console.log("\nTodos los tests del cliente BCB pasaron.");
}
