import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: any) { console.error('Keys boundary:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex items-center justify-center p-10">
          <div className="card max-w-lg w-full p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-xl font-bold mb-2">Algo salió mal</h2>
            <p className="text-fg-muted text-sm mb-1">Error inesperado al renderizar.</p>
            <p className="text-xs text-fg-subtle mb-6 font-mono break-all">{this.state.error.message}</p>
            <button onClick={() => location.reload()} className="btn btn-primary text-sm">
              <RefreshCw size={14} /> Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
