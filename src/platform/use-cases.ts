export type UseCaseId = "client_guidance" | "financial_inclusion" | "document_review" | "operations" | "security_review";
export type WorkspaceRole = "client" | "bank_operator" | "reviewer" | "security_analyst";

export type UseCaseDefinition = {
  id: UseCaseId;
  title: string;
  shortTitle: string;
  audience: string;
  problem: string;
  input: string;
  output: string;
  localBenefit: string;
  limitations: string[];
  entryMode: "client" | "inclusion" | "documents" | "operations" | "security";
};

export const USE_CASES: UseCaseDefinition[] = [
  { id: "client_guidance", shortTitle: "Orientar al cliente", title: "Orientación bancaria privada", audience: "Cliente y asesor", problem: "Entender opciones y próximos pasos sin compartir datos personales con terceros.", input: "Pregunta, meta y catálogo sintético local", output: "Orientación con fuentes y solicitud en borrador", localBenefit: "La conversación permanece en el dispositivo o infraestructura privada.", limitations: ["No aprueba productos", "No envía solicitudes reales"], entryMode: "client" },
  { id: "financial_inclusion", shortTitle: "Ampliar acceso", title: "Inclusión financiera", audience: "Cliente con conectividad intermitente", problem: "Reducir barreras de idioma, comprensión y conectividad.", input: "Guías locales bilingües y pregunta en lenguaje natural", output: "Explicación clara y accesible", localBenefit: "El contenido sigue disponible sin depender de una API de inferencia externa.", limitations: ["No sustituye asesoría regulada", "Usa contenido de demostración"], entryMode: "inclusion" },
  { id: "document_review", shortTitle: "Revisar expedientes", title: "Documentos y trámites", audience: "Ejecutivo y revisor bancario", problem: "Validar expedientes sensibles con evidencia trazable.", input: "PDF sintético y procedimiento local", output: "Campos, faltantes, contradicciones y evidencia por página", localBenefit: "Los documentos no salen del entorno local durante el análisis.", limitations: ["Requiere revisión humana", "No decide aprobación"], entryMode: "documents" },
  { id: "operations", shortTitle: "Asistir operación", title: "Operación interna", audience: "Personal operativo", problem: "Consultar procedimientos sin exponer información operativa a servicios externos.", input: "Pregunta y procedimiento versionado local", output: "Regla aplicable, fuente y tarea pendiente", localBenefit: "La consulta se resuelve contra conocimiento local y versionado.", limitations: ["No ejecuta cambios", "No reemplaza el procedimiento institucional"], entryMode: "operations" },
  { id: "security_review", shortTitle: "Investigar señales", title: "Seguridad explicable", audience: "Analista de seguridad", problem: "Detectar patrones sobre información que debe permanecer dentro del banco.", input: "Transacciones sintéticas y reglas locales", output: "Señales explicables y transacciones relacionadas", localBenefit: "El análisis puede operar dentro de la infraestructura protegida.", limitations: ["No declara fraude", "No bloquea operaciones"], entryMode: "security" },
];

export const ARCHITECTURE = {
  provider: "QVAC local" as const,
  model: "LLAMA_3_2_1B_INST_Q4_0",
  inferenceBoundary: "La inferencia ocurre en el dispositivo o infraestructura local; no hay ruta cloud de inferencia.",
  dataPolicy: "La demo usa exclusivamente datos sintéticos; los datos sensibles no salen del entorno autorizado.",
  validation: "Las reglas deterministas y la evidencia verificable complementan la salida del modelo.",
  humanControl: "Toda alerta, orientación o decisión queda para revisión humana.",
  pearsExtension: "Pears queda reservado como extensión futura para delegación entre pares; no se simula en esta demo.",
};
