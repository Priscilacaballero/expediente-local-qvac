# Guion de demostración

1. Mostrar la pantalla `Expediente Local` y la marca `DATOS SINTÉTICOS — DEMO`.
2. Explicar que la inferencia usa QVAC local y el modelo `LLAMA_3_2_1B_INST_Q4_0`.
3. Ejecutar `npm run seed` y seleccionar `case-0001`.
4. Cargar un PDF legible y mostrar que aparece con páginas y hash.
5. Ejecutar el análisis y mostrar que las fuentes se conservan separadas de las respuestas del ejecutivo.
6. Seleccionar un caso con faltante y explicar que queda como `requiere_datos`.
7. Seleccionar un caso discrepante y explicar que requiere revisión humana y no prueba fraude.
8. Generar el reporte HTML local.
9. Mostrar `npm run offline` y `docs/evaluation.md`.

La demo no debe mostrar documentos reales, secretos, rutas del sistema ni datos fuera del alcance sintético.
