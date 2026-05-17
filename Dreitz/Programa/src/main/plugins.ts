/**
 * Minimal plugin loader.
 * Plugins live in `%APPDATA%/Dreitzteam/plugins/<slug>/plugin.json` + `index.js` (CSS optional).
 *
 * plugin.json example:
 *   { "slug": "neon-theme", "name": "Neon Theme", "version": "1.0.0", "author": "X", "css": "style.css" }
 *
 * For safety, we DO NOT execute the plugin's JS in the main process. We only ship
 * its CSS to the renderer when enabled, plus exposing metadata. JS execution is
 * deferred to a future sandboxed iframe.
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import log from './logger';
import { getDb } from './db';

export interface PluginManifest {
  slug: string;
  name: string;
  version?: string;
  author?: string;
  css?: string;
}

function pluginsDir(): string {
  const dir = path.join(app.getPath('appData'), 'Dreitzteam', 'plugins');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getPluginsDir(): string {
  return pluginsDir();
}

export interface PluginScanEntry {
  manifest: PluginManifest;
  cssPath: string | null;
  error?: string;
  folder: string;
}

export function scanPlugins(): PluginScanEntry[] {
  const dir = pluginsDir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: PluginScanEntry[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name, 'plugin.json');
    if (!fs.existsSync(p)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(p, 'utf8')) as PluginManifest;
      if (!manifest.slug || !manifest.name) {
        out.push({
          manifest: { slug: e.name, name: e.name } as PluginManifest,
          cssPath: null,
          folder: e.name,
          error: 'Manifest sin slug o name'
        });
        continue;
      }
      const cssPath = manifest.css ? path.join(dir, e.name, manifest.css) : null;
      out.push({
        manifest,
        cssPath: cssPath && fs.existsSync(cssPath) ? cssPath : null,
        folder: e.name,
        error: manifest.css && cssPath && !fs.existsSync(cssPath) ? `CSS no encontrado: ${manifest.css}` : undefined
      });
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      log.warn(`Plugin manifest parse failed (${e.name}):`, msg);
      // Surface the error to the UI so the user knows why a folder didn't load,
      // instead of silently disappearing.
      out.push({
        manifest: { slug: e.name, name: `${e.name} (inválido)` } as PluginManifest,
        cssPath: null,
        folder: e.name,
        error: `plugin.json inválido: ${msg}`
      });
    }
  }
  return out;
}

export function syncPluginsToDb() {
  const db = getDb();
  const found = scanPlugins();
  // Insert any new ones as disabled
  for (const { manifest } of found) {
    db.prepare(`
      INSERT OR IGNORE INTO plugins (slug, name, version, author, enabled) VALUES (?, ?, ?, ?, 0)
    `).run(manifest.slug, manifest.name, manifest.version ?? null, manifest.author ?? null);
  }
  return found;
}

export function listPlugins() {
  syncPluginsToDb();
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM plugins ORDER BY name`).all() as any[];
  // Attach manifest if found
  const found = scanPlugins();
  const result = rows.map((r) => {
    const f = found.find((x) => x.manifest.slug === r.slug);
    return {
      ...r,
      enabled: !!r.enabled,
      manifest: f?.manifest ?? null,
      hasCss: !!f?.cssPath,
      error: f?.error ?? null
    };
  });
  // Also include "broken" entries that exist on disk but aren't in DB yet
  // so the user sees why their folder isn't loading.
  for (const f of found) {
    if (f.error && !result.some((r) => r.slug === f.manifest.slug)) {
      result.push({
        slug: f.manifest.slug,
        name: f.manifest.name,
        version: null,
        author: null,
        enabled: false,
        manifest: f.manifest,
        hasCss: !!f.cssPath,
        error: f.error
      });
    }
  }
  return result;
}

export function setEnabled(slug: string, enabled: boolean) {
  getDb().prepare(`UPDATE plugins SET enabled = ? WHERE slug = ?`).run(enabled ? 1 : 0, slug);
  return { success: true };
}

export function getEnabledCss(): string {
  const db = getDb();
  const enabled = db.prepare(`SELECT slug FROM plugins WHERE enabled = 1`).all() as any[];
  const found = scanPlugins();
  let combined = '';
  for (const e of enabled) {
    const f = found.find((x) => x.manifest.slug === e.slug);
    if (f?.cssPath) {
      try {
        combined += `\n/* === ${e.slug} === */\n` + fs.readFileSync(f.cssPath, 'utf8');
      } catch {}
    }
  }
  return combined;
}
