import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface Template {
  id: number;
  slug: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

/**
 * Editor de plantillas de mensajes (WhatsApp / email).
 * El cuerpo soporta variables `{{nombre}}`, `{{juego}}`, `{{clave}}`, etc.
 * — el render real se hace cuando el admin envía una clave desde Licencias.
 */
export default function Templates() {
  const [list, setList] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  async function load() {
    const r: Template[] = await window.api.templatesList();
    setList(r);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.slug || !editing?.title || !editing?.body) return toast.error('Slug, título y cuerpo requeridos');
    try {
      await window.api.templatesUpsert({
        id: editing.id,
        slug: editing.slug,
        title: editing.title,
        body: editing.body
      });
      toast.success('Plantilla guardada');
      setEditing(null);
      await load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(id: number) {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    await window.api.templatesDelete(id);
    toast.success('Plantilla eliminada');
    await load();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <FileText className="text-purple-400" size={28} />
          <h2 className="text-3xl font-bold">Plantillas de mensajes</h2>
        </div>
        <button
          onClick={() => setEditing({ slug: '', title: '', body: '' })}
          className="btn btn-primary text-sm flex items-center gap-2"
        >
          <Plus size={14} /> Nueva plantilla
        </button>
      </div>
      <p className="text-fg-muted text-sm mb-6">
        Mensajes pre-rellenados para enviar claves por WhatsApp/email. Soporta variables:
        <code className="text-accent ml-2">{`{{nombre}}`}</code>
        <code className="text-accent ml-2">{`{{juego}}`}</code>
        <code className="text-accent ml-2">{`{{clave}}`}</code>
        <code className="text-accent ml-2">{`{{fecha}}`}</code>
      </p>

      {editing && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">{editing.id ? 'Editar' : 'Nueva'} plantilla</h3>
            <button onClick={() => setEditing(null)} className="text-fg-muted hover:text-fg"><X size={16} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-xs font-semibold text-fg-muted mb-1 block">Slug (interno)</span>
              <input
                className="input font-mono text-sm"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="whatsapp_default"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-fg-muted mb-1 block">Título</span>
              <input
                className="input"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="WhatsApp · entrega de clave"
              />
            </label>
          </div>
          <label className="block mb-4">
            <span className="text-xs font-semibold text-fg-muted mb-1 block">Cuerpo del mensaje</span>
            <textarea
              className="input min-h-[200px] font-mono text-sm"
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              placeholder={'¡Hola {{nombre}}! 🎮\n\nTu copia de {{juego}} está lista.\nClave: {{clave}}'}
            />
          </label>
          <button onClick={save} className="btn btn-primary text-sm flex items-center gap-2">
            <Save size={14} /> Guardar plantilla
          </button>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {list.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold">{t.title}</div>
                <code className="text-[10px] text-fg-subtle">{t.slug}</code>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(t)} className="btn text-xs px-2">Editar</button>
                <button onClick={() => remove(t.id)} className="btn text-xs px-2 hover:text-red-400" title="Eliminar">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <pre className="text-xs text-fg-muted whitespace-pre-wrap font-sans bg-bg-elev p-3 rounded line-clamp-6">
              {t.body}
            </pre>
          </div>
        ))}
        {list.length === 0 && (
          <div className="md:col-span-2 card p-10 text-center text-fg-muted">
            No tienes plantillas aún. Crea una para enviar claves rápido por WhatsApp.
          </div>
        )}
      </div>
    </div>
  );
}
