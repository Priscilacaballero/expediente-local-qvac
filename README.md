# Expediente Local QVAC

Asistente local para preparar y revisar expedientes bancarios sintéticos, con inferencia ejecutada mediante QVAC y evidencia trazable para revisión humana.

Este proyecto usa únicamente datos sintéticos para demostración. La inferencia se ejecuta localmente con QVAC; no se envían documentos ni datos del expediente a servicios de nube.

## Estado del desarrollo

La validación local de QVAC ya fue ejecutada en esta máquina. Las mediciones y la huella del modelo se conservan en `docs/model-manifest.json`.

## Requisitos

- Node.js 22.17 o superior.
- npm 10.9 o superior.

## Comandos

```bash
npm ci
npm run build
npm test
```

Los comandos `seed`, `offline`, `qvac:offline-smoke` y `measure` preparan la demo, verifican restricciones offline, prueban inferencia local y generan métricas.

## Problema y flujo

Expediente Local es ahora un Centro Bancario Local con cinco modos aislados de interfaz: Cliente, Inclusión, Documentos, Operación y Seguridad. Ayuda a orientar con contenido financiero sintético, revisar expedientes, consultar procedimientos y detectar señales de riesgo para revisión humana. Todo el procesamiento de IA ocurre localmente con QVAC; no hay APIs de inferencia en la nube.

El modo Cliente ofrece productos, guías y asistente bilingüe con citas locales, además de borradores de orientación sin aprobación ni envío externo. Documentos conserva extracción, clasificación, hash y evidencia por página. Operación consulta procedimientos locales y revisa borradores. Seguridad evalúa transacciones sintéticas, contradicciones documentales e instrucciones maliciosas, sin bloquear cuentas, acusar fraude ni tomar decisiones automáticas.

La interfaz es una PWA instalable con caché local de la aplicación y muestra el estado sin internet. Los catálogos `data/synthetic/banking-catalog.json`, `education-guides.json` y `transactions.json` están versionados y marcados como sintéticos.

Una contradicción significa revisión humana; no prueba fraude. Una respuesta del ejecutivo permanece separada de la evidencia documental.

## Arquitectura

- React 19 y Vite 7: interfaz de una sola pantalla.
- Fastify 5: API local en `127.0.0.1:4173`.
- SQLite con `better-sqlite3`: casos, documentos por página, campos, hallazgos, respuestas y ejecuciones.
- `pdf-parse`: extracción de texto seleccionable por página.
- MiniSearch: búsqueda local de `procedure-v1`.
- Zod: validación de contratos.
- QVAC SDK: única ruta de inferencia local.

## QVAC y modelo

El modelo configurado es `LLAMA_3_2_1B_INST_Q4_0`. La aplicación no usa API de nube, embeddings remotos, OCR, voz, scoring, fraude, transacciones ni proveedor alternativo. La primera ejecución de `npm run qvac:smoke` descarga el peso oficial de QVAC al caché local; las siguientes cargas reutilizan esa copia.

Ejecuta `npm run qvac:offline-smoke` tras preparar los pesos. Este comando bloquea las conexiones externas controladas por Node y solo conserva el loopback necesario para QVAC; falla si detecta un intento de salida.

## Instalación y ejecución

```bash
npm ci
npm run seed
npm run build
npm test
npm run offline
npm run qvac:offline-smoke
npm run measure
npm start
```

`npm run seed` genera los PDFs sintéticos y los carga en SQLite. El servidor completo sirve la interfaz y la API en `127.0.0.1:4173`.

## Datos sintéticos

Los fixtures se generan con la semilla `20260910` y llevan la marca `DATOS SINTÉTICOS — DEMO`. Hay diez casos: completo, faltantes, discrepancias, PDF vacío, imagen, prompt injection, pregunta fuera de alcance y respuesta separada. `data/synthetic/hashes.json` permite comprobar que dos generaciones sean iguales.

## Agente y herramientas

El controlador acepta únicamente `tool_call`, `message` y `finish`. Tiene máximo seis llamadas, un reintento de formato y valida el estado final mediante código. Las siete herramientas autorizadas son `list_documents`, `read_document`, `extract_fields`, `search_procedure`, `validate_case`, `record_user_answer` y `prepare_report`.

## Seguridad y evaluación

Se aceptan solo PDFs con texto seleccionable, MIME correcto y tamaño máximo de 10 MB. Se rechazan traversal, rutas, caracteres de control, citas no verificables y recursos de otro caso. `npm run offline` comprueba loopback y la ausencia de fallback; `docs/evaluation.md` conserva las métricas sintéticas y sus denominadores.

## Licencias y reutilización

El código de aplicación fue desarrollado para este reto. Se utilizan las dependencias listadas en `package.json` y el SDK/modelo de QVAC según sus respectivas licencias.
El guion de demostración está en `docs/demo-script.md`. La muestra es sintética y pequeña y no representa una decisión bancaria real.
