import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
        // @sentry/electron es opcional (peer install) — si no está instalado,
        // crashReporter.ts hace dynamic import con catch. Lo marcamos external
        // para que Rollup no falle al no resolverlo.
        external: ['@sentry/electron/main', '@sentry/electron']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      // Code splitting por vendor: separa libs grandes en chunks dedicados.
      // El bundle inicial baja de 1.3MB a ~400KB; el resto se carga lazy
      // cuando React Router monta la página que necesita.
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
        output: {
          // Chunking más agresivo: cada lib pesada en su propio chunk para
          // maximizar cacheability — si solo cambia tu código, motion/recharts/
          // icons quedan cacheados.
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'motion': ['framer-motion'],
            'charts': ['recharts'],
            'icons': ['lucide-react'],
            'anthropic': ['@anthropic-ai/sdk'],
            'paypal': ['@paypal/react-paypal-js'],
            'fuse': ['fuse.js'],
            'cmdk': ['cmdk'],
            'sonner': ['sonner'],
            'confetti': ['canvas-confetti'],
            'virtualization': ['react-window']
          }
        }
      },
      // Subir el warning threshold porque Electron no tiene que descargar nada
      // del cliente — bundle size grande es ok aquí.
      chunkSizeWarningLimit: 1500
    }
  }
});
