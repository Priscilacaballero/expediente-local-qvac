import { useEffect, useState } from "react";
import { apiClient, type AssistantAnswer } from "../api-client.js";
import { AssistantComposer } from "./AssistantComposer.js";

type RequestRow = { id: string; productId: string; message: string; status: string };

export function OperationsMode() {
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void apiClient.orientationRequests().then(value => setRequests(Array.isArray(value) ? value : [])).catch(() => setNotice("No se pudieron cargar las solicitudes locales.")); }, []);

  const ask = async () => {
    if (!query.trim()) return;
    setBusy(true); setNotice("");
    try {
      const result = await apiClient.procedureAssistant(language, query);
      setAnswer({ answer: result.answer ?? "No hay una respuesta local disponible.", sources: Array.isArray(result.sources) ? result.sources : [], provider: result.provider ?? "local-safe-fallback" });
    } catch { setNotice("No se pudo consultar el procedimiento local."); }
    finally { setBusy(false); }
  };

  return <section className="mode-content">
    <div className="mode-heading"><div><span className="eyebrow">OPERACIÓN INTERNA</span><h2>Asistente de procedimientos</h2><p>Busca reglas locales y prepara tareas para revisión del personal. No ejecuta cambios.</p></div><select aria-label="Idioma del procedimiento" value={language} onChange={event => setLanguage(event.target.value as "es" | "en")}><option value="es">Español</option><option value="en">English</option></select></div>
    <AssistantComposer eyebrow="REGLAS LOCALES" title="Consulta al agente operativo" description="Describe lo que necesitas revisar y te mostraré la regla aplicable, sus límites y la fuente." inputLabel="Consulta de procedimiento" placeholder="Ej.: ¿qué revisar en un expediente?" submitLabel="Consultar regla" suggestions={["¿Qué revisar en un expediente?", "¿Qué documentos son obligatorios?", "¿Cuándo requiere revisión humana?"]} query={query} busy={busy} onQueryChange={setQuery} onAsk={() => void ask()} answer={answer && <p>{answer.answer}</p>} answerMeta={`Fuentes: ${(answer?.sources ?? []).map(source => source.title).join(", ") || "base local"}`} />
    <article className="mode-card"><h3>Solicitudes de orientación pendientes</h3>{requests.length ? requests.map(request => <div className="list-row" key={request.id}><strong>{request.productId}</strong><span>{request.message}</span><Status status={request.status} /></div>) : <p>No hay borradores pendientes.</p>}{notice && <p className="notice" role="status">{notice}</p>}</article>
  </section>;
}

function Status({ status }: { status: string }) { return <span className="status-pill">{status === "pending_human_review" ? "Revisión humana" : status}</span>; }
