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

## Preparación manual pendiente

- [ ] Preparar los pesos locales de `LLAMA_3_2_1B_INST_Q4_0`.
- [ ] Ejecutar `npm run qvac:smoke` y conservar el manifest actualizado.
- [ ] Grabar el video siguiendo `docs/demo-script.md`.
- [ ] Probar el flujo completo con el modelo local preparado.
- [ ] Confirmar el acceso al video junto con el repositorio y el tag.

La aplicación no usa fallback remoto cuando QVAC no está listo.
