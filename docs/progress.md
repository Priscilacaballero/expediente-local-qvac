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
