import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Sub-proyecto Vite del landing público de Dreitz.
 *
 * El build escupe directamente a `../../Website/` (carpeta hermana de Programa).
 * De esta forma:
 *   - `Programa/` contiene TODO el source (Electron app + landing source aquí).
 *   - `Website/` queda en la raíz como una carpeta limpia con SOLO archivos
 *     estáticos listos para Netlify / Vercel / GitHub Pages / S3.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: {
    outDir: path.resolve(__dirname, '../../Website'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    // Senior-dev rollup config: hash en filename → cache-busting + immutable cache.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
});
