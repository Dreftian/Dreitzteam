import { useEffect, useState } from 'react';
import { BarChart3, Check, Info } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Tarjeta de Ajustes para alternar la telemetría opt-in.
 *
 * Por defecto está OFF. Cuando el usuario la activa, Dreitz envía a InsForge
 * eventos anonimizados: arranques, crashes con stack (sin paths personales),
 * IPCs lentos. No se envían usernames, emails, IDs ni búsquedas.
 */
export default function TelemetryCard() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.api.telemetryGet?.()
      .then((r: any) => setEnabled(!!r?.enabled))
      .finally(() => setLoaded(true));
  }, []);

  async function toggle() {
    const nuevo = !enabled;
    setEnabled(nuevo);
    try {
      await window.api.telemetrySet?.(nuevo);
      toast.success(nuevo ? 'Telemetría activada · gracias!' : 'Telemetría desactivada');
    } catch {
      setEnabled(!nuevo); // revert
      toast.error('No se pudo guardar el ajuste');
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={17} className="text-purple-400" />
        <h3 className="font-bold">Telemetría opcional</h3>
      </div>
      <p className="text-xs text-fg-muted mb-3">
        Si la activas, Dreitz envía métricas anónimas (arranques, crashes, IPCs lentos) para
        cazar bugs que no podemos reproducir en local. <b>NO se envían</b> tu username, email,
        IDs ni el contenido de tus búsquedas. Puedes apagarla cuando quieras.
      </p>

      <div className="flex items-center justify-between p-3 rounded-md bg-bg-elev border border-border">
        <div className="flex items-center gap-2 text-sm">
          {enabled ? (
            <span className="flex items-center gap-1.5 text-green-400 font-medium">
              <Check size={13} /> Ayudándonos a mejorar Dreitz
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-fg-muted">
              <Info size={13} /> Telemetría apagada
            </span>
          )}
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            onChange={toggle}
            disabled={!loaded}
          />
          <div className="w-10 h-5.5 bg-bg-base border border-border peer-checked:bg-accent/30 peer-checked:border-accent rounded-full transition-all relative">
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all ${enabled ? 'translate-x-5 bg-accent' : 'bg-fg-muted'}`} />
          </div>
        </label>
      </div>
    </section>
  );
}
