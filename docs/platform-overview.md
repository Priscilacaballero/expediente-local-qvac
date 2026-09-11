# Centro de trabajo de plataforma

La aplicación presenta cinco espacios conectados por el mismo flujo: seleccionar objetivo, procesar localmente, revisar evidencia y escalar a una persona.

| Espacio | Usuario | Resultado | Límite |
| --- | --- | --- | --- |
| Orientación bancaria | Cliente y asesor | Orientación con fuentes y borrador | No aprueba ni envía solicitudes |
| Inclusión financiera | Cliente con conectividad intermitente | Explicación clara y bilingüe | No sustituye asesoría regulada |
| Documentos y trámites | Ejecutivo y revisor | Campos, faltantes, contradicciones y evidencia | No decide aprobación |
| Operación interna | Personal operativo | Regla local y tarea pendiente | No ejecuta cambios |
| Seguridad explicable | Analista | Señales y transacciones relacionadas | No declara fraude ni bloquea |

La arquitectura común es: dato autorizado → QVAC local → reglas y evidencia → revisión humana. La plataforma usa datos sintéticos para la demo y no tiene una ruta cloud de inferencia. Pears queda como extensión futura de delegación entre pares y no se simula.

## Recorrido actualizado de cinco minutos

1. Mostrar el tablero Centro de trabajo y sus objetivos.
2. Abrir orientación, consultar un producto y preguntar al asistente local con sus fuentes.
3. Guardar interés como borrador pendiente de revisión.
4. Abrir Documentos, seleccionar `case-0002`, ejecutar análisis y mostrar faltantes y evidencia.
5. Mostrar `case-0004` y `case-0008` para explicar conflictos y prompt injection tratado como dato.
6. Consultar una regla en Operación y mostrar que no ejecuta cambios.
7. Mostrar una señal en Seguridad y explicar que no es fraude confirmado.
8. Cerrar con arquitectura, actividad reciente, QVAC local, modo offline y datos sintéticos.
