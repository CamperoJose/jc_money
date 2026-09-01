# Especificación e Instrucciones — MyMoney Web

Documento maestro para el desarrollo de una aplicación web personal de gestión de finanzas e inversiones. Está escrito para que un futuro chat de Claude tome este archivo como única fuente de verdad y ejecute la construcción sin necesidad de recontextualizar.

Versión del documento: 1.1 (agrega sistema de diseño shadcn/ui, tema tweakcn e iconos Phosphor)
Idioma de trabajo del proyecto: Español
Origen de datos: archivo `My_Money_v5_0.xlsx` (5 hojas), propiedad del usuario.

---

## 1. Propósito del documento

Este archivo define qué se va a construir, con qué tecnologías, con qué modelo de datos y en qué orden. El primer hito es llevar el Excel actual del usuario a una base de datos real y exponerlo en un apartado llamado **Tracking**. El documento también contempla el sistema completo desde el arranque, porque el usuario pidió que la base de datos exista desde el inicio y que la arquitectura no se rehaga después.

El futuro chat debe leer las secciones 4, 7, 8 y 17 antes de escribir una sola línea de código.

---

## 2. Contexto y objetivo del producto

El usuario lleva su vida financiera en una planilla de Excel con cinco hojas. Quiere migrar esa planilla a una aplicación web propia, de un solo usuario, con estas metas.

- Ver y editar sus datos en PC con una vista tipo hoja de cálculo, mejorada.
- Consultar lo mismo en el celular de forma responsiva.
- Registrar gastos por voz en el celular, dictando una frase natural que la app convierte en un registro estructurado.
- Recibir recordatorios por correo personal, principalmente sobre inversiones.
- Ver dashboards de su situación financiera.
- Recibir correos de estado actual.
- Tener una base de datos real que respalde su información automáticamente en su Google Drive.
- No pagar por nada, salvo, si fuese estrictamente necesario, el uso de una API de IA (Gemini) para la automatización por voz.

---

## 3. Principios y restricciones de diseño

Estos principios son obligatorios y condicionan todas las decisiones posteriores.

1. **Costo cero.** Todo debe funcionar en planes gratuitos. El único gasto tolerado, y solo si fuese necesario, es la API de Gemini, que además tiene una capa gratuita permanente suficiente para uso personal.
2. **Un solo usuario.** La aplicación es de uso estrictamente personal. Aun así se implementa autenticación real y control de acceso a nivel de fila, por seguridad.
3. **API primero.** El backend se diseña como una API que la propia web consume. Así la web, la ingesta por voz y cualquier automatización futura hablan con el mismo backend, sin lógica duplicada.
4. **La base de datos existe desde el inicio.** No se arranca con almacenamiento temporal ni con datos en memoria. El primer commit funcional ya persiste en la base de datos.
5. **Fidelidad con mejora.** La vista de Tracking replica la lógica del Excel del usuario, pero mejorada, en formato híbrido (grid editable en PC más dashboards y tarjetas en celular).
6. **Español en todo.** Interfaz, categorías, mensajes y correos en español.

---

## 4. Stack tecnológico definitivo

Estas decisiones ya fueron confirmadas por el usuario y no deben reabrirse salvo indicación expresa.

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework front y back | Next.js (App Router, React) | Un solo proyecto, front y API en el mismo código |
| Hosting | Vercel, plan Hobby | Gratuito. El back corre como funciones serverless |
| Base de datos | Supabase (Postgres) | Trae Auth y Storage incluidos |
| Autenticación | Supabase Auth con proveedor Google | Restringida al correo del usuario |
| Sistema de diseño | shadcn/ui | Decidido. Componentes que se copian al proyecto y se poseen como código propio. Corre sobre Tailwind |
| Tema visual | tweakcn | Editor de tema para shadcn. El tema se define en https://tweakcn.com/editor/theme y se exporta a la app |
| Iconos | Phosphor Icons | Decidido. Se descargan e integran al proyecto. Pesos Fill y Duotone para el toque premium |
| Grid tipo Excel | AG Grid Community (licencia MIT) | Gratuito, edición en celda, filtros, agrupación |
| Dashboards | Tremor o Recharts | Gratuitos. Tremor combina bien con shadcn y Tailwind |
| Estilos y responsivo | Tailwind CSS | Base de shadcn. Vista de tarjetas en celular |
| IA para voz | Gemini Flash (audio directo a JSON) | Capa gratuita permanente, suficiente para uso personal |
| Envío de correos | Nodemailer con SMTP de Gmail (app password) | Gratuito para envíos a uno mismo. Alternativa Resend |
| Programador de tareas | GitHub Actions con schedule, o cron-job.org | El cron de Vercel Hobby solo permite una ejecución diaria, por eso se usa un programador externo que llama a las rutas API |
| Respaldos | Google Drive API con service account | Respaldo en SQL y en CSV |

### 4.1 Sistema de diseño e identidad visual

El diseño se construye sobre shadcn/ui, decidido como sistema base. No es una librería tradicional. Sus componentes se copian al repositorio con la CLI y quedan como código propio del proyecto, sin dependencias externas ni versiones que actualizar. Corre sobre Tailwind CSS.

Advertencia importante sobre la apariencia. El aspecto por defecto de shadcn es el mismo que generan casi todas las herramientas de andamiaje, así que sin personalizar se ve genérico. Para evitarlo, la identidad visual se define en tweakcn, un editor visual de tema para shadcn. El tema se arma en https://tweakcn.com/editor/theme, ajustando colores, radios y tipografía, y se exporta como variables CSS que se pegan en el archivo de estilos global (globals.css) y en la configuración de Tailwind. La dirección visual buscada es un tema oscuro tipo centro de mando financiero privado, con un único acento cálido dorado reservado para lo más importante, como el patrimonio neto y los estados activos. El futuro chat debe pedir al usuario el tema exportado desde tweakcn antes de estilizar, y no inventar una paleta propia.

Iconos. Se usa Phosphor Icons, decidido. Se descargan e integran al proyecto, ya sea por su paquete de React o incorporando los SVG necesarios. Se aprovechan sus variantes de peso, en particular Fill para estados activos y Duotone para acentos, que son las que dan el aire premium que se busca. Phosphor queda como set principal y no se mezcla con otros sets al azar, para mantener coherencia.

Reparto de responsabilidades visuales. shadcn cubre los componentes de interfaz (botones, formularios, diálogos, tablas base). Tremor se reserva para las vistas de indicadores y gráficos de los dashboards. AG Grid Community se reserva para la vista de grid editable tipo Excel en PC. Phosphor provee todos los iconos.

---

## 5. Arquitectura general

La aplicación es un monolito de Next.js desplegado en Vercel. El front en React consume una API interna construida con Route Handlers. La persistencia vive en Supabase Postgres. Los procesos programados no dependen del cron de Vercel, sino de un programador externo gratuito que invoca rutas API protegidas por token.

Flujo de componentes.

1. **Web (PC y celular).** El usuario inicia sesión con Google (Supabase Auth). La web consume la API interna para leer y escribir.
2. **Ingesta por voz.** El celular graba audio y lo envía a una ruta de ingesta. Esa ruta manda el audio a Gemini Flash, recibe un JSON estructurado, lo valida contra los catálogos, completa la fecha si falta y guarda la transacción.
3. **API con token.** Las rutas pensadas para máquinas (ingesta, respaldos, recordatorios, correos de estado) se autentican con un token tipo Bearer guardado como variable de entorno. Esto deja la puerta lista para Siri y otras automatizaciones. Siri es un objetivo futuro, no del primer hito.
4. **Programador externo.** GitHub Actions o cron-job.org llaman a las rutas de recordatorios, correos de estado y respaldos en los horarios definidos.
5. **Respaldos.** Un job diario exporta la base en formato SQL y en CSV y los sube, versionados por fecha, a una carpeta de Google Drive del usuario.

---

## 6. Decisiones confirmadas por el usuario

Registro literal de lo acordado, para trazabilidad.

| Nro | Tema | Decisión |
|-----|------|----------|
| 1 | Orden de módulos | No especificado por el usuario. Se asume Patrimonio y Gastos primero, luego Inversiones, al final Deudas. Reordenable |
| 2 | Base de datos desde el inicio | Sí. Todo persiste en base de datos desde el primer arranque |
| 3 | Modelo de gastos | Registro simple pero robusto (no doble entrada) |
| 4 | Cuentas y catálogos | Sí, se requieren parámetros configurables para cuentas y categorías |
| 5 | Multimoneda | Sí. Base en Bolivianos, con ponderación final mostrada en Bolivianos y en Dólares |
| 6 | Cálculo de inversiones | El usuario ingresa los valores. La app no recalcula automáticamente cada DPF, pero sí agrega los indicadores del panel |
| 7 | Proyección de laddering | Simulador interactivo |
| 8 | Vista de Tracking | Réplica mejorada, híbrida (grid editable más dashboards) |
| 9 | Autenticación | Según recomendación. Supabase Auth con Google |
| 10 | Base de datos | Supabase |
| 11 | Respaldos a Drive | Ambos formatos, SQL y CSV |
| 12 | Voz | Audio directo a Gemini. Siri se considera futuro |
| 13 | API con token | Sí, según recomendación. Token Bearer desde el inicio |

---

## 7. Modelo de datos

Base de datos Postgres en Supabase. Todas las tablas llevan `id` como clave primaria, `user_id` para el control de acceso por fila, y marcas de tiempo `created_at` y `updated_at`. Se activa Row Level Security en todas las tablas con la política `user_id = auth.uid()`, incluso siendo de un solo usuario.

Moneda base: Bolivianos (BOB). Las monedas soportadas son BOB, USD y USDT.

### 7.1 Catálogos y parámetros

**accounts** (cuentas y billeteras, configurables)

- `name` texto, nombre visible.
- `type` enum: banco, efectivo, stablecoin, tarjeta_credito, dpf, otro.
- `currency` enum: BOB, USD, USDT.
- `is_liability` booleano. Verdadero para tarjetas de crédito y pasivos.
- `active` booleano.

Semilla inicial derivada del Excel: Banco SOL, Fortaleza, BMSC, BNB, IDEPRO CA, Efectivo Bs, Efectivo USD, USDT, DPF Congelado. Se agrega Tarjeta Mercantil con tipo tarjeta_credito, porque aparece en el ejemplo de voz del usuario y es un pasivo, no un saldo.

**categories** (categorías de gasto e ingreso)

- `name` texto.
- `kind` enum: gasto, ingreso.
- `parent_id` referencia opcional a la misma tabla, para subcategorías.
- `active` booleano.

Se parte con un conjunto básico en español (Alimentación, Transporte, Salud, Servicios, Ocio, Trámites, Tecnología, Sueldo, Rendimientos, Otros) y el usuario lo ajusta.

### 7.2 Patrimonio, a partir de la hoja CONTEOS

La hoja Conteos registra fotos del patrimonio por fecha. Cada fila tiene un tipo de cambio (T/C) y saldos por cuenta. La columna Total del Excel calcula la suma de las cuentas en Bolivianos, más el T/C multiplicado por la suma de efectivo en USD y USDT, más los ajustes de DPF y deudas de esa fila.

Se modela en formato largo, una fila por cuenta por foto, que es más limpio que replicar columnas fijas.

**net_worth_snapshots**

- `snapshot_date` fecha.
- `exchange_rate` numérico, Bolivianos por Dólar (el T/C).
- `total_bob` numérico, calculado y almacenado para fidelidad histórica.
- `total_usd` numérico, calculado (`total_bob / exchange_rate`).
- `note` texto opcional.

**net_worth_balances**

- `snapshot_id` referencia a net_worth_snapshots.
- `account_id` referencia a accounts.
- `amount` numérico, en la moneda de la cuenta.

Regla de cálculo del patrimonio de una foto. Se suman los saldos de cuentas en BOB, se suman los saldos en USD y USDT convertidos a BOB con el T/C de la foto, y se restan los pasivos (cuentas con is_liability verdadero, como tarjetas de crédito, y las deudas). El resultado es total_bob. El total_usd se obtiene dividiendo total_bob entre el T/C. Se muestran ambos, según la decisión 5.

### 7.3 Gastos e ingresos, a partir de la hoja GASTOS PRESUPUESTO

El Excel usa doble entrada (DEBE y HABER). Por decisión 3 se simplifica a registro simple pero robusto, con un campo de tipo. DEBE se mapea a gasto y HABER se mapea a ingreso.

**transactions**

- `txn_date` fecha.
- `type` enum: gasto, ingreso.
- `amount` numérico, positivo.
- `currency` enum: BOB, USD, USDT.
- `exchange_rate` numérico opcional, requerido si la moneda no es BOB.
- `account_id` referencia a accounts (cuenta o método de pago usado).
- `category_id` referencia a categories.
- `description` texto (el DETALLE del Excel).
- `tags` arreglo de texto, opcional.
- `source` enum: manual, voz, api.
- `raw_voice_text` texto opcional, guarda la frase original dictada, para auditoría.

**budgets** (presupuesto, la parte PRESUPUESTO de la hoja)

- `period` texto en formato año-mes.
- `category_id` referencia a categories.
- `amount_planned` numérico.

El presupuesto es de segunda prioridad dentro del módulo de gastos, pero la tabla se crea desde el inicio.

### 7.4 Inversiones DPF, a partir de la hoja DPF LADDERING REAL

Un DPF es un Depósito a Plazo Fijo. La estrategia de laddering consiste en escalonar varios depósitos con vencimientos distribuidos. Por decisión 6, el usuario ingresa los valores de cada DPF. La app no recalcula el interés de cada depósito, pero sí calcula los indicadores agregados del panel a partir de lo almacenado.

**dpf_deposits**

- `nro_dpf` texto o entero, correlativo del usuario.
- `pizarra` texto opcional.
- `edv` texto opcional.
- `id_dpf_externo` texto, el identificador de la entidad.
- `start_date` fecha (FECHA INICIO).
- `end_date` fecha (FECHA FIN).
- `principal` numérico en BOB (MONTO).
- `term_days` entero (PLAZO, por ejemplo 90).
- `annual_rate` numérico (porcentaje anual, por ejemplo 0.077).
- `status` enum: activo, pagado.
- `gcia_economica` numérico, ingresado por el usuario (ganancia bruta).
- `gcia_financiera` numérico, ingresado por el usuario (ganancia líquida).
- `rc_iva_retencion` numérico, ingresado o derivado (economica menos financiera).
- `account_id` referencia a accounts.
- `notes` texto opcional.

Campos derivados en lectura, no almacenados: días restantes (end_date menos hoy) e interés diario informativo. El panel de indicadores se calcula por agregación, ver sección 10.

Nota informativa sobre RC-IVA. En Bolivia se retiene el 13 por ciento sobre los rendimientos financieros. La ganancia líquida equivale aproximadamente a la ganancia bruta multiplicada por 0.87. Como el usuario ingresa los valores, esto es solo una referencia de validación, no un cálculo forzado.

### 7.5 Proyección de laddering, a partir de la hoja DPF LADDERING PROYECTION

Por decisión 7 esto es un simulador interactivo, no una tabla estática migrada. No se migran las filas de la hoja de proyección. De ella se extraen los supuestos base (plazo de 90 días, tasa cercana a 0.077, cadencia de nuevos depósitos cada 30 días, y el aporte de salario) para precargar el simulador.

**projection_scenarios** (opcional, para guardar escenarios)

- `name` texto.
- `params` JSON con los supuestos: monto inicial, aporte por periodo, cadencia en días, plazo en días, tasa anual, salario bruto y líquido, horizonte en meses.

La lógica del simulador se describe en la sección 10.

### 7.6 Deudas, a partir de la hoja DEUDAS

**debts**

- `debt_date` fecha.
- `amount` numérico.
- `reason` texto (Razon).
- `status` enum: pendiente, parcial, pagado.
- `counterparty` texto opcional.
- `due_date` fecha opcional.

### 7.7 Sistema

**reminders**

- `title` texto.
- `remind_at` marca de tiempo.
- `recurrence` enum: ninguna, diaria, semanal, mensual.
- `channel` enum: email.
- `related_type` enum opcional: inversion, deuda, generico.
- `related_id` referencia opcional.
- `active` booleano.
- `last_sent_at` marca de tiempo opcional.

Para el MVP el token de la API vive como variable de entorno. Si más adelante se quiere revocación, se agrega una tabla de tokens.

---

## 8. Módulo Tracking, primer hito

El apartado Tracking es la traducción del Excel a la web. Se compone de cuatro sub módulos que comparten el patrón de vista híbrida. En PC se muestra un grid editable tipo AG Grid con filtros y agregados. En celular se muestra una vista de tarjetas o lista, más los dashboards.

Orden de construcción asumido (decisión 1 no especificada, reordenable).

1. **Patrimonio.** Vista de fotos de patrimonio con su evolución. Grid de saldos por cuenta y por fecha. Dashboard con la curva de patrimonio neto en Bolivianos y en Dólares, y la distribución por cuenta y por moneda.
2. **Gastos.** Grid de transacciones con filtros por fecha, categoría, cuenta y tipo. Dashboard de gasto por categoría y por mes, e ingreso contra gasto. Comparación contra presupuesto en una fase posterior.
3. **Inversiones DPF.** Grid de depósitos con estado y vencimientos. Panel de indicadores replicando el del Excel. Simulador de proyección como pantalla aparte.
4. **Deudas.** Grid simple de deudas con su estado.

Todos los sub módulos escriben y leen de la base de datos desde el inicio, según la decisión 2.

---

## 9. Plan de migración del Excel

El objetivo es cargar el histórico del Excel a la base de datos. El futuro chat debe generar un script de importación en Python (pandas y openpyxl) que se ejecute una sola vez contra Supabase. Consideraciones observadas en el archivo real.

- Las fechas ya se leen como fechas reales con openpyxl, no requieren conversión manual de número serial, salvo celdas sueltas que pudieran venir como número.
- Hay datos sucios que se deben descartar o marcar: al menos una celda con `#ERROR!`, una nota de texto libre dentro de Conteos, y filas sueltas de cálculo al final de algunas hojas.
- Algunas celdas de Conteos contienen fórmulas simples en lugar de valores (por ejemplo sumas como `=4920+51.2`). El script debe leer el valor calculado, cargando el libro con `data_only=True` para esas hojas, o evaluando la expresión.

Mapeo hoja por hoja.

- **CONTEOS** hacia net_worth_snapshots y net_worth_balances. La fila de encabezado está en la cuarta fila. Las columnas son FECHA, T/C y luego una columna por cuenta. Cada fila de datos genera una foto y varios balances. El T/C va a exchange_rate. El total se recalcula con la regla de la sección 7.2, no se copia ciegamente, para corregir las inconsistencias de la planilla.
- **GASTOS PRESUPUESTO** hacia transactions. Los encabezados de periodo (una fila con solo una fecha) delimitan el mes. Debajo, las columnas DEBE, HABER, DETALLE y FECHA. DEBE genera transacciones tipo gasto y HABER tipo ingreso. La categoría inicial queda como Otros y se reclasifica después. Opcionalmente se usa Gemini en lote para sugerir categorías a partir del DETALLE.
- **DPF LADDERING REAL** hacia dpf_deposits, desde la fila 11 en adelante. Las filas 3 a 6 son el panel y no se migran, se recalculan. Se determina el estado activo o pagado según la columna correspondiente y la fecha fin.
- **DPF LADDERING PROYECTION** no se migra fila por fila. Se extraen los supuestos para precargar el simulador.
- **DEUDAS** hacia debts. La hoja está casi vacía, se migra lo que haya.

El script debe ser idempotente en lo posible, o al menos avisar antes de duplicar. Se recomienda una bandera de origen para poder distinguir e incluso revertir la carga inicial.

---

## 10. Cálculos, indicadores y simulador

### 10.1 Panel de indicadores de DPF

Replicando el panel del Excel, calculado por agregación sobre dpf_deposits. Todos derivados en lectura.

- Monto en DPF, suma de principal de los depósitos activos, menos lo liberado.
- Ganancia económica, suma de gcia_economica.
- Ganancia líquida, suma de gcia_financiera.
- Retención RC-IVA, ganancia económica menos ganancia líquida.
- Tasa promedio, promedio de annual_rate de los activos.
- Días invertido, hoy menos la fecha de inicio más antigua.
- DPFs activos, cantidad con estado activo.
- Próximo vencimiento, menor end_date futuro, con sus días restantes.
- Rendimiento neto total, ganancia económica dividida entre el capital invertido.
- Total de DPFs históricos, cantidad total de registros.

### 10.2 Patrimonio neto

Por cada foto se calcula total_bob y total_usd con la regla de la sección 7.2. El dashboard muestra la serie temporal de ambos, la distribución por cuenta y por moneda, y la variación respecto de la foto anterior.

### 10.3 Simulador de proyección de laddering

Calculadora interactiva. Entradas configurables por el usuario: monto inicial, aporte por periodo, cadencia en días (por ejemplo 30), plazo del DPF en días (por ejemplo 90), tasa anual, salario bruto y líquido, y horizonte en meses.

Lógica. En cada periodo se abre un nuevo depósito con el monto del aporte más el capital liberado de depósitos que vencen, más el aporte de salario. El interés bruto de un depósito es el monto por la tasa anual por el plazo dividido entre 360. El interés líquido aplica la retención del 13 por ciento, es decir el bruto por 0.87. La salida es una tabla proyectada con fecha de inicio y fin, monto, monto liberado, ganancia bruta, ganancia líquida y aporte de salario, más los totales de ganancia y capital al final del horizonte. La proyección se recalcula al vuelo cuando el usuario cambia cualquier supuesto.

---

## 11. Registro de gasto por voz

Objetivo. El usuario dicta una frase como "anota 250.5 bolivianos por pago de gimnasio con tarjeta de crédito Mercantil" y la app crea la transacción completa, poniendo fecha, categoría y cuenta.

Flujo.

1. El celular graba el audio y lo envía a la ruta de ingesta.
2. La ruta envía el audio directamente a Gemini Flash, con un prompt de sistema en español que exige responder solo con un JSON que cumpla un esquema fijo.
3. La respuesta se valida. La categoría y la cuenta se mapean contra los catálogos existentes. Si falta la fecha, se usa la fecha actual.
4. Se inserta la transacción con source igual a voz y se guarda la frase original en raw_voice_text.
5. Se devuelve el registro para confirmación en pantalla, con opción de corregir antes de dar por bueno.

Esquema de salida esperado de Gemini.

```json
{
  "type": "gasto | ingreso",
  "amount": 0,
  "currency": "BOB | USD | USDT",
  "category": "texto a mapear contra categories",
  "account": "texto a mapear contra accounts",
  "description": "texto",
  "date": "YYYY-MM-DD, por defecto hoy",
  "confidence": 0.0
}
```

Consideraciones. Se usa audio directo a Gemini por decisión 12, para no depender del soporte irregular del reconocimiento de voz del navegador en iOS. El modelo debe entender bolivianos, la abreviatura bs, nombres de bancos locales y el término tarjeta de crédito. La capa gratuita de Gemini alcanza de sobra para el volumen personal.

---

## 12. Diseño de la API

La API es interna y a la vez la base de futuras automatizaciones. Dos mecanismos de autenticación conviven. La web usa la sesión de Supabase por cookie. Las rutas para máquinas usan un token tipo Bearer en el encabezado Authorization, validado contra una variable de entorno con comparación en tiempo constante.

Rutas principales, todas bajo el prefijo de API.

- Ingesta. Crea una transacción a partir de texto o audio. Protegida por Bearer. Es la ruta que en el futuro consumirá Siri.
- Transacciones. Altas, bajas, cambios y listados con filtros.
- Cuentas y categorías. Gestión de catálogos.
- DPF. Gestión de depósitos y consulta del panel de indicadores.
- Deudas. Gestión de deudas.
- Patrimonio. Alta y consulta de fotos y balances.
- Resumen de dashboard. Devuelve los indicadores agregados.
- Simulación de proyección. Recibe los supuestos y devuelve la tabla proyectada.
- Ejecutar respaldo. Invocada por el programador externo, protegida por token.
- Despachar recordatorios. Invocada por el programador externo, envía los recordatorios pendientes.
- Enviar correo de estado. Invocada por el programador externo.

Siri es un objetivo futuro. No se implementa en el primer hito, pero la ruta de ingesta se deja lista para que un Atajo de Apple la consuma con el token.

---

## 13. Autenticación y control de acceso

Supabase Auth con proveedor Google, según decisión 9. El acceso se restringe al correo del usuario, ya sea con una lista blanca en el middleware o con una verificación en las políticas de acceso. Se activa Row Level Security en todas las tablas, con la política de que cada fila pertenece al usuario autenticado. Aunque el sistema es de un solo usuario, esta capa evita fugas si algún día la instancia queda expuesta.

---

## 14. Recordatorios y correos

Envío de correos con Nodemailer y el SMTP de Gmail usando una contraseña de aplicación, gratuito para envíos al propio usuario. Alternativa Resend si se prefiere un servicio dedicado.

La programación no usa el cron de Vercel, porque el plan Hobby solo permite una ejecución diaria y sin precisión de minuto. En su lugar, un programador externo gratuito (GitHub Actions con schedule, o cron-job.org) llama a las rutas de recordatorios y de correo de estado en los horarios definidos, enviando el token Bearer.

Casos de uso. Recordatorio de vencimiento de un DPF con varios días de anticipación. Recordatorio de una deuda por cobrar o pagar. Correo periódico de estado con el patrimonio actual, el gasto del mes y los próximos vencimientos.

---

## 15. Respaldos a Google Drive

Por decisión 11 se generan ambos formatos. Un job diario, disparado por el programador externo, exporta la base en un volcado SQL restaurable y además en archivos CSV por tabla, legibles en Excel. Los archivos se suben, versionados por fecha, a una carpeta específica de Google Drive del usuario mediante la Google Drive API con un service account.

Se recomienda una política de retención, por ejemplo conservar los últimos 30 respaldos diarios y 12 mensuales, para no llenar el espacio. El acceso a Drive por parte de la app es un permiso separado del inicio de sesión del usuario, y se resuelve con un service account o un refresh token dedicado, no mezclado con el login de Google.

---

## 16. Hoja de ruta por fases

**Fase 0, preparación.** Repositorio Next.js, proyecto Supabase, creación del esquema completo con Row Level Security, semillas de catálogos, autenticación con Google, despliegue inicial en Vercel.

**Fase 1, primer hito, Tracking.** Migración del Excel a la base de datos y construcción del apartado Tracking con sus cuatro sub módulos en formato híbrido, más los dashboards básicos. Todo persistiendo en base de datos desde el inicio.

**Fase 2, automatización.** Registro por voz con Gemini, recordatorios y correos de estado con el programador externo, y respaldos a Google Drive.

**Fase 3, avanzado.** Simulador de proyección interactivo pulido, documentación de la API y preparación del Atajo de Siri.

---

## 17. Instrucciones para el futuro chat

Al retomar este proyecto, procede en este orden.

1. Lee las secciones 4, 4.1, 7, 8 y 9 de este documento. Son las que condicionan la implementación.
2. No reabras las decisiones de la sección 6 salvo que el usuario lo pida.
3. Comienza por la Fase 0. Deja el esquema de base de datos y la autenticación funcionando antes de tocar la interfaz.
3.1. Instala shadcn/ui y Phosphor Icons en el proyecto. Antes de estilizar cualquier pantalla, pide al usuario el tema exportado desde https://tweakcn.com/editor/theme y aplícalo en globals.css y en la configuración de Tailwind. No inventes una paleta propia ni dejes el tema por defecto de shadcn, porque es lo que hace que la interfaz se vea genérica.
4. Crea las tablas exactamente como se describen en la sección 7, con Row Level Security activo desde el inicio.
5. Para la migración del Excel, genera un script de importación en Python siguiendo la sección 9. Antes de correrlo, muéstrale al usuario un resumen de cuántos registros se cargarán por hoja y qué filas se descartaron por datos sucios.
6. Construye el apartado Tracking en el orden de la sección 8, empezando por Patrimonio y Gastos. Confirma con el usuario si prefiere otro orden, ya que la decisión 1 quedó abierta.
7. Respeta el principio de API primero. La interfaz consume la API, no accede a la base por atajos.
8. Mantén todo en planes gratuitos. Si algo empujara a un plan de pago, detente y consúltalo con el usuario antes de seguir.
9. Escribe la interfaz, las categorías y los correos en español.
10. Al cerrar cada fase, deja anotado el estado para poder retomar.

---

## 18. Preguntas abiertas

Estas quedan por definir con el usuario y no bloquean el arranque.

- Orden definitivo de construcción de los sub módulos de Tracking (decisión 1).
- Conjunto inicial de categorías de gasto e ingreso.
- Anticipación deseada para los recordatorios de vencimiento de DPF.
- Frecuencia del correo de estado (semanal o mensual).
- Política de retención concreta de los respaldos.
- Si el presupuesto (budgets) entra en la Fase 1 o se posterga a una fase posterior.

---

Fin del documento.
