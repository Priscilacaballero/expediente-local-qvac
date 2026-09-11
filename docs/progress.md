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
