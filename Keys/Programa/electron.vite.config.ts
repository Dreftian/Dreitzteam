import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias: { '@renderer': resolve(__dirname, 'src/renderer/src') } },
    plugins: [react()],
    build: {
      // Code splitting por vendor — baja el bundle inicial de 1.74MB a ~600KB.
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'motion': ['framer-motion'],
            'icons': ['lucide-react'],
            'charts': ['recharts'],
            'qrcode': ['qrcode']
          }
        }
      },
      chunkSizeWarningLimit: 1200
    }
  }
});
