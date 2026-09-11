import { Component, type ErrorInfo, type ReactNode } from "react";
type Props = { children: ReactNode; name: string };
type State = { error: Error | null };
export class UiErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error(`Error en ${this.props.name}`, error, info); }
  render() { if (!this.state.error) return this.props.children; return <section className="mode-card ui-error-card" role="alert"><span className="eyebrow">MÓDULO NO DISPONIBLE</span><h2>No se pudo mostrar {this.props.name}</h2><p>{this.state.error.message || "Ocurrió un error inesperado en la interfaz local."}</p><button className="primary-button" type="button" onClick={() => this.setState({ error: null })}>Reintentar</button></section>; }
}
