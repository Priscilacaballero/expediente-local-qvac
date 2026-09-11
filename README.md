# Expediente Local QVAC

Asistente local para preparar y revisar expedientes bancarios sintéticos, con inferencia ejecutada mediante QVAC y evidencia trazable para revisión humana.

Este proyecto usa únicamente datos sintéticos para demostración. La inferencia se ejecutará localmente con QVAC; no se enviarán documentos ni datos del expediente a servicios de nube.

## Estado del desarrollo

El proyecto se implementa fase por fase según el plan operativo. La primera fase establece el bootstrap técnico; las capacidades de negocio se incorporarán en las fases siguientes.

## Requisitos

- Node.js 22.17 o superior.
- npm 10.9 o superior.

## Comandos

```bash
npm ci
npm run build
npm test
```

Los comandos `seed`, `offline` y `measure` quedarán habilitados conforme se incorporen sus fases correspondientes.

## Licencias y reutilización

El código de aplicación fue desarrollado para este reto. Se utilizan las dependencias listadas en `package.json` y el SDK/modelo de QVAC según sus respectivas licencias.
