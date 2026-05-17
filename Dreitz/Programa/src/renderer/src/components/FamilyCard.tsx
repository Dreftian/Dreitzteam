import { useEffect, useState } from 'react';
import { Users, Copy, LogOut, Loader2, Gamepad2, Clock, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface Miembro {
  user_id: number;
  username: string;
  playing_title?: string | null;
  playing_game_id?: number | null;
  last_ping?: string;
}
interface RankingRow { user_id: number; username: string; minutes: number }

/**
 * Tarjeta de Ajustes para el "modo familia".
 *
 * - Si el usuario no está en una familia: botones "Crear" / "Unirse con código".
 * - Si ya está: muestra el código (para compartir con familiares), lista de
 *   miembros activos (ping < 5 min) con qué están jugando, y "Salir".
 *
 * El polling de miembros corre cada 60s.
 */
export default function FamilyCard() {
  const { user } = useAuth();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function refrescar() {
    if (!user) return;
    try {
      const g: any = await window.api.familyGet?.(user.id);
      setFamilyId(g?.family_id ?? null);
      if (g?.family_id) {
        // Ping presencia + listar miembros + ranking semanal
        window.api.familyPing?.({ userId: user.id }).catch(() => {});
        const [list, rank]: any = await Promise.all([
          window.api.familyList?.(user.id),
          window.api.familyWeeklyRanking?.(user.id)
        ]);
        setMiembros(Array.isArray(list) ? list : []);
        setRanking(Array.isArray(rank) ? rank : []);
      }
    } catch {}
  }

  useEffect(() => {
    refrescar();
    if (!user) return;
    const id = setInterval(refrescar, 60_000);
    return () => clearInterval(id);
  }, [user?.id]);

  async function crearFamilia() {
    if (!user) return;
    setBusy(true);
    try {
      const r: any = await window.api.familyCreate?.(user.id);
      if (r?.family_id) {
        toast.success(`Familia creada: ${r.family_id}`);
        await refrescar();
      }
    } finally { setBusy(false); }
  }

  async function unirse() {
    if (!user || !joinCode.trim()) return;
    setBusy(true);
    try {
      const r: any = await window.api.familyJoin?.({ userId: user.id, family_id: joinCode.trim() });
      if (r?.ok) {
        toast.success('Unido a la familia');
        setJoinCode('');
        await refrescar();
      } else {
        toast.error(r?.error ?? 'No se pudo unir');
      }
    } finally { setBusy(false); }
  }

  async function salir() {
    if (!user || !confirm('¿Salir de la familia? Dejarás de ver a los demás miembros.')) return;
    setBusy(true);
    try {
      await window.api.familyLeave?.(user.id);
      toast.success('Saliste de la familia');
      setFamilyId(null);
      setMiembros([]);
    } finally { setBusy(false); }
  }

  function copiarCodigo() {
    if (!familyId) return;
    navigator.clipboard.writeText(familyId).then(
      () => toast.success('Código copiado'),
      () => toast.error('No se pudo copiar')
    );
  }

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users size={17} className="text-pink-400" />
        <h3 className="font-bold">Modo familia</h3>
      </div>
      <p className="text-xs text-fg-muted mb-4">
        Varios usuarios bajo un mismo código comparten <b>presence</b>: puedes ver quién está
        jugando qué en tiempo real, en otra PC. No compartimos tu biblioteca ni tu historial
        de compras — solo "online" y "jugando ahora".
      </p>

      {!familyId ? (
        <div className="space-y-3">
          <button
            onClick={crearFamilia}
            disabled={busy}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            Crear una familia
          </button>
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold text-center my-2">o</div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Código de 6 chars (ej. AB12CD)"
              className="input flex-1 font-mono uppercase text-sm"
              maxLength={8}
            />
            <button
              onClick={unirse}
              disabled={busy || !joinCode.trim()}
              className="btn text-sm"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Unirse'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between p-3 rounded-md bg-bg-elev border border-border mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-semibold">Código familia</div>
              <div className="font-mono text-lg font-bold tracking-widest text-accent">{familyId}</div>
            </div>
            <button onClick={copiarCodigo} className="btn text-xs flex items-center gap-1.5">
              <Copy size={12} /> Copiar
            </button>
          </div>

          <div className="text-xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">
            Miembros activos {miembros.length > 0 ? `· ${miembros.length}` : ''}
          </div>
          {miembros.length === 0 ? (
            <div className="text-sm text-fg-subtle italic">
              Comparte tu código y espera a que se unan los demás.
            </div>
          ) : (
            <ul className="space-y-2 mb-4">
              {miembros.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-md bg-bg-elev">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold relative">
                    {m.username.slice(0, 1).toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-bg-card" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{m.username}</div>
                    {m.playing_title ? (
                      <div className="text-[11px] text-cyan-400 flex items-center gap-1 truncate">
                        <Gamepad2 size={10} /> Jugando: {m.playing_title}
                      </div>
                    ) : (
                      <div className="text-[11px] text-fg-subtle flex items-center gap-1">
                        <Clock size={10} /> En línea
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Ranking semanal — quién jugó más horas en los últimos 7 días.
              Gamificación interna; los 3 primeros llevan medalla. */}
          {ranking.length > 0 && (
            <div className="mt-4 mb-4 p-3 rounded-md bg-bg-elev border border-border">
              <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-fg-subtle font-semibold">
                <Trophy size={12} className="text-yellow-400" /> Ranking semanal · 7 días
              </div>
              <ol className="space-y-1.5">
                {ranking.map((r, i) => {
                  const medal = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
                  const hours = (r.minutes / 60).toFixed(1);
                  return (
                    <li key={r.user_id} className={`flex items-center gap-2 text-sm ${r.user_id === user?.id ? 'text-accent font-semibold' : ''}`}>
                      <span className="w-6 text-center text-base">{medal}</span>
                      <span className="flex-1 truncate">{r.username}</span>
                      <span className="text-fg-muted text-xs tabular-nums">{hours} h</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <button
            onClick={salir}
            disabled={busy}
            className="btn text-xs hover:text-red-400 flex items-center gap-1.5"
          >
            <LogOut size={12} /> Salir de la familia
          </button>
        </>
      )}
    </section>
  );
}
