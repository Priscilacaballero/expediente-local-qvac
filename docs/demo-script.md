# Guion de demostración

1. Mostrar la pantalla `Expediente Local` y la marca `DATOS SINTÉTICOS — DEMO`.
2. Explicar que la inferencia usa QVAC local y el modelo `LLAMA_3_2_1B_INST_Q4_0`.
3. Ejecutar `npm run seed` y seleccionar `case-0001`, que inicia con documentos sintéticos cargados.
4. Ejecutar el análisis y mostrar campos extraídos, páginas, citas y hash de cada documento.
5. Seleccionar un caso con faltante, como `case-0002`, y explicar que queda como `requiere_datos`.
6. Seleccionar `case-0004` y explicar que una discrepancia requiere revisión humana y no prueba fraude.
7. Seleccionar `case-0008` y mostrar que una instrucción dentro del documento se trata como dato no confiable.
8. Abrir un hallazgo para mostrar documento, página y cita; después generar el reporte HTML local.
9. Mostrar `npm run qvac:offline-smoke`, `npm run offline` y `docs/evaluation.md`.

La demo no debe mostrar documentos reales, secretos, rutas del sistema ni datos fuera del alcance sintético.
