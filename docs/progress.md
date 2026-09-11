# Progreso de desarrollo

## Fase 1 — Bootstrap del proyecto

- Estado: implementada.
- Alcance: configuración inicial de TypeScript, Vite, React, dependencias, scripts, variables de entorno, documentación y directorios base.
- Verificación completada: `npm ci`, `npm run build` y `npm test` pasan correctamente.
- Resultado: 1 prueba de bootstrap aprobada; build de Vite generado en `dist/ui`.

## Fase 2 — QVAC real y configuración local

- Estado: implementada; verificación local del código completada.
- Se añadieron configuración Zod, adaptador QVAC, descriptor/hash del modelo, prompt fijo y smoke test con validación Zod.
- `npm run build` y `npm test` pasan correctamente.
- El smoke test real queda listo para ejecutar con `npm run qvac:smoke` después de la preparación manual de los pesos; no se descargaron automáticamente porque el modelo aún no está presente localmente.
- Verificación final repetida: `npm ci`, `npm run build` y `npm test` pasan correctamente.

## Fase 3 — Dominio y persistencia

- Estado: implementada y verificada.
- Se añadieron los contratos de dominio/API/agente, SQLite local con WAL, claves foráneas, busy timeout de cinco segundos y migraciones idempotentes.
- Se crearon repositorios parametrizados para casos, documentos, campos, hallazgos, respuestas y ejecuciones del agente.
- Se verificó aislamiento entre casos y persistencia después de cerrar y reabrir la base.
- Verificación: `npm run build` y `npm test` pasan; 4 pruebas aprobadas.

## Fase 4 — Fixtures y procedimiento ficticio

- Estado: implementada y verificada.
- Se creó el procedimiento local `procedure-v1` con seis reglas y ocho campos requeridos.
- Se definieron diez casos sintéticos con resultados esperados y escenarios de faltantes, conflictos, PDF vacío, imagen, prompt injection y pregunta fuera de alcance.
- Se creó un generador determinista con semilla `20260910`, PDFs de texto seleccionable y hashes SHA-256.
- Verificación: `npm run seed` genera 10 casos, 13 documentos/hashes y confirma determinismo; `npm run build` y `npm test` pasan con 4 pruebas aprobadas.

## Fase 5 — Ingestión y evidencia

- Estado: implementada y verificada.
- Se añadieron políticas para aceptar únicamente PDF con MIME correcto, límite de 10 MB y nombres sin rutas, traversal ni caracteres de control.
- Se implementó extracción de texto por página con SHA-256 y rechazo de PDF sin texto seleccionable.
- Se implementó validación literal de citas antes de crear evidencias.
- Verificación: PDF sintético aceptado con texto y hash; cita exacta verificada; PDF vacío rechazado; metadata insegura y cita inventada rechazadas. `npm run build` y `npm test` pasan con 7 pruebas aprobadas.

## Fase 6 — Búsqueda del procedimiento

- Estado: implementada y verificada.
- Se creó un índice local e inmutable de `procedure-v1` con MiniSearch.
- Las búsquedas devuelven como máximo cinco reglas e incluyen siempre `procedureVersion` y `rule_id`.
- Se rechazan URLs, rutas y caracteres de control.
- Verificación: build y suite pasan con 9 pruebas aprobadas.

## Fase 7 — Herramientas del agente

- Estado: implementada y verificada.
- Se registraron exactamente las siete herramientas autorizadas del plan.
- Se añadieron validación de documentos, extracción de candidatos, validación determinista, respuestas separadas y reporte factual desde SQLite.
- Las herramientas validan el caso solicitado y rechazan registros no autorizados.
- Verificación: build y suite pasan con 12 pruebas aprobadas.

## Fase 8 — Controlador agéntico

- Estado: implementada y verificada.
- Se añadió contexto de caso limitado, contrato de acciones JSON y bucle agéntico con máximo seis llamadas.
- Se permite un solo reintento de formato y se devuelve `AGENT_FORMAT_ERROR` si vuelve a fallar.
- Se validan herramientas, respuestas separadas y estado final mediante código.
- Verificación: build y suite pasan con 14 pruebas aprobadas.

## Fase 9 — API local

- Estado: implementada y verificada.
- Se añadieron las rutas locales de sesión, salud, casos, documentos, páginas, turnos del agente, respuestas y reportes.
- Se configuraron multipart con límite de 10 MB, manejo de errores controlado, deduplicación por `requestId` y servicio del build de Vite.
- El servidor queda preparado para escuchar únicamente en `127.0.0.1:4173` y devuelve `QVAC_NOT_READY` si el modelo no está disponible.
- Verificación: build exitoso, `dist/server.js` generado y suite con 15 pruebas aprobadas.

## Fase 10 — Interfaz React

- Estado: implementada y verificada.
- Se construyó una pantalla única en español con columnas de Documentos, Conversación y Revisión.
- Se añadieron carga de PDF, estado de QVAC, mensajes de error/reintento, análisis, checklist, panel de evidencia y descarga de reporte HTML local.
- La interfaz muestra explícitamente que usa datos sintéticos, QVAC local y que una discrepancia requiere revisión humana, no implica fraude.
- Verificación: build de Vite exitoso y suite con 15 pruebas aprobadas.

## Fase 11 — Seguridad y offline

- Estado: implementada y verificada.
- Se añadió `npm run offline` para comprobar loopback, puerto fijo, modelo QVAC único, procedimiento local, fixtures sintéticos y ausencia de fallback de proveedor.
- Se eliminó la dependencia de fuentes externas en la interfaz.
- Verificación: `npm run offline`, build y suite pasan.

## Fase 12 — Evaluación

- Estado: implementada y verificada.
- Se añadió `npm run measure` para generar `docs/evaluation.md` con numeradores, denominadores y límites de la muestra sintética.
- La evaluación cubre los 10 casos definidos, resultados esperados y escenarios de seguridad/alcance.
- Verificación: evaluación generada, build y suite pasan con 15 pruebas aprobadas.

## Fase 13 — Documentación

- Estado: implementada y verificada.
- README ampliado con problema, flujo, arquitectura, QVAC, modelo, SDK, instalación, offline, datos sintéticos, agente, herramientas, seguridad, evaluación, reutilización y límites.
- Se añadió `docs/demo-script.md` para reproducir la demostración.
- Verificación: offline, evaluación, build y suite pasan con 15 pruebas aprobadas.

## Fase 14 — Entrega

- Estado: código de entrega completado; solo quedan la grabación/publicación del video y la confirmación de su enlace.
- Se añadió `docs/delivery-checklist.md` con comandos automatizados y pasos finales.
- El repositorio carga automáticamente los casos sintéticos, persiste campos y evidencia por página, genera reportes locales y conserva un fallback seguro si el modelo no produce el contrato JSON.
- Verificación final actualizada: seed, build, 17 pruebas, `qvac:offline-smoke`, offline, measure y flujo HTTP completo pasan.

## Expansión — Centro Bancario Local QVAC

- Estado: implementada; quedan únicamente la grabación y publicación manual del video.
- Se incorporaron Cliente/Inclusión, Documentos, Operación y Seguridad en una navegación única, con español/inglés, alto contraste, texto grande y estado offline.
- Se añadieron catálogo, guías, solicitudes, procedimientos, transacciones y alertas sintéticas en SQLite; las alertas quedan siempre para revisión humana.
- Se añadió PWA local con manifest y service worker, clasificación documental y detección de frecuencia, monto inusual y beneficiario nuevo.
- Verificación: build, pruebas automatizadas, validación offline, métricas y smoke QVAC deben ejecutarse después del cierre de esta expansión.
