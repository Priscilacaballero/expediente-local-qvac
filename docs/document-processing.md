# Procesamiento documental local

El flujo documental no usa servicios cloud. Los archivos se almacenan temporalmente en `.qvac/document-assets/` y sus evidencias se registran en SQLite.

## Modelos

| Rol | Modelo |
|---|---|
| Agente y razonamiento | `LLAMA_3_2_1B_INST_Q4_0` |
| OCR | `OCR_LATIN` |
| Revisión visual | `VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M` + `MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` |

Preparar los pesos explícitamente antes de activar OCR/visión:

```bash
npm run qvac:prepare-docs
```

El servidor arranca por defecto solo con el modelo textual. Para cargar OCR y visión durante el arranque, configura `QVAC_LOAD_DOCUMENT_MODELS=true`. Una solicitud nunca descarga pesos: si falta un modelo, el documento queda en `requires_review` con un error accionable.

## Formatos y estados

- PDF textual: `pdf-parse` por página; no ejecuta OCR ni visión automáticamente.
- PNG/JPG: OCR local QVAC; la revisión visual queda como evidencia posterior.
- PDF escaneado: rasterización local página por página, OCR y revisión visual posterior.

La subida responde `202` con `documentId` y `jobId`. El progreso se consulta en `GET /api/cases/:caseId/documents/:documentId/processing`; los assets y sus dimensiones en `/assets`. Se puede reintentar con `POST /reprocess`.

Cada candidato conserva método, modelo, página, cita, confianza y `bbox` relativo al asset cuando QVAC lo proporciona. La visión únicamente genera evidencia y `requires_review`; la confirmación final corresponde al revisor humano.
