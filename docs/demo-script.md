# Guion de demostración

1. Mostrar `Centro Bancario Local`, la marca `DATOS SINTÉTICOS — DEMO` y el estado `QVAC local`.
2. En `Cliente e Inclusión`, cambiar entre Español claro e English, consultar un producto y una guía, y hacer una pregunta al asistente local con sus fuentes.
3. Guardar interés por un producto. Explicar que queda como borrador sintético y que no es una aprobación ni un envío bancario.
4. En `Operación`, consultar un procedimiento y mostrar la solicitud pendiente para revisión humana.
5. En `Documentos`, seleccionar `case-0001`, ejecutar el análisis y mostrar campos extraídos, páginas, citas y hash.
6. Seleccionar `case-0002` (faltante), `case-0004` (conflicto) y `case-0008` (prompt injection tratado como dato) para explicar la revisión segura.
7. En `Seguridad`, mostrar transacciones sintéticas y alertas de frecuencia, monto/destinatario nuevo; explicar que ninguna alerta bloquea o acusa.
8. Activar texto grande/alto contraste y mostrar el aviso de modo local. Luego enseñar `npm run qvac:offline-smoke`, `npm run offline` y `docs/evaluation.md`.

La demo no debe mostrar documentos reales, secretos, rutas del sistema ni datos fuera del alcance sintético.
