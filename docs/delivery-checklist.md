# Checklist de entrega

## Automatizado

- [x] `npm ci`
- [x] `npm run seed`
- [x] `npm run build`
- [x] `npm test`
- [x] `npm run offline`
- [x] `npm run measure`
- [x] Push de cada fase a `main`
- [x] Documentación de reproducción

## Expansión Centro Bancario Local

- [x] Modos Cliente/Inclusión, Documentos, Operación y Seguridad.
- [x] Catálogo y guías bilingües versionados con datos sintéticos.
- [x] Solicitudes locales para revisión humana.
- [x] PWA con manifest, service worker y aviso offline.
- [x] Clasificación documental y alertas transaccionales sintéticas.
- [x] Controles iniciales de accesibilidad y fuentes locales.
- [x] Prohibición explícita de bloqueos, acusaciones y decisiones automáticas.

## Preparación manual pendiente

- [x] Preparar los pesos locales de `LLAMA_3_2_1B_INST_Q4_0`.
- [x] Ejecutar `npm run qvac:offline-smoke` y conservar el manifest actualizado.
- [ ] Grabar el video siguiendo `docs/demo-script.md`.
- [x] Probar el flujo completo con el modelo local preparado.
- [ ] Confirmar el acceso al video junto con el repositorio y el tag.

La aplicación no usa fallback remoto cuando QVAC no está listo.
