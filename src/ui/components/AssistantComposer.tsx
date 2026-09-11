import type { FormEvent, ReactNode } from "react";

type AssistantComposerProps = {
  eyebrow: string;
  title: string;
  description: string;
  inputLabel: string;
  placeholder: string;
  submitLabel: string;
  suggestions: string[];
  query: string;
  busy: boolean;
  answer?: ReactNode;
  answerMeta?: string;
  onQueryChange: (value: string) => void;
  onAsk: () => void;
};

export function AssistantComposer({ eyebrow, title, description, inputLabel, placeholder, submitLabel, suggestions, query, busy, answer, answerMeta, onQueryChange, onAsk }: AssistantComposerProps) {
  const submit = (event: FormEvent) => { event.preventDefault(); if (query.trim() && !busy) onAsk(); };
  return <article className="mode-card assistant-card">
    <div className="assistant-heading"><div><span className="card-kicker">{eyebrow}</span><h3>{title}</h3></div><span className="assistant-live"><i /> QVAC local</span></div>
    <p className="helper-text">{description}</p>
    <div className="suggestion-row" aria-label="Preguntas sugeridas">{suggestions.map(suggestion => <button className="suggestion-chip" type="button" key={suggestion} onClick={() => onQueryChange(suggestion)}>{suggestion}</button>)}</div>
    <form className="assistant-form" onSubmit={submit}>
      <label className="sr-only" htmlFor={inputLabel}>{inputLabel}</label>
      <div className="assistant-input-wrap"><span className="assistant-input-icon">✦</span><input id={inputLabel} aria-label={inputLabel} value={query} onChange={event => onQueryChange(event.target.value)} placeholder={placeholder} maxLength={500} /><span className="char-count">{query.length}/500</span></div>
      <div className="assistant-actions"><small>Enter para enviar · tus datos permanecen localmente</small><div>{query && <button className="clear-button" type="button" onClick={() => onQueryChange("")}>Limpiar</button>}<button className="assistant-submit" type="submit" disabled={busy || !query.trim()}>{busy ? <><span className="loading-dots"><i /><i /><i /></span> Preparando…</> : <>{submitLabel} <span>↗</span></>}</button></div></div>
    </form>
    {answer && <div className="assistant-response" role="status" aria-live="polite"><div className="response-avatar">EL</div><div className="response-body"><span className="response-label">Respuesta del agente</span>{answer}<small>{answerMeta}</small></div></div>}
  </article>;
}
