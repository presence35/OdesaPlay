import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ODESA ГРА',
        short_name: 'ODESA ГРА',
        description: 'Грайте за Одесу',
        start_url: '/',
        display: 'fullscreen',
        background_color: '#0a0a0c',
        theme_color: '#0a0a0c',
        icons: [
          {src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml'},
          {src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml'},
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\.(mp3|ogg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              expiration: {maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30},
            },
          },
        ],
      },
    })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('pixi.js')) return 'vendor-pixi';
            if (id.includes('firebase/')) return 'vendor-firebase';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'vendor-react';
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
