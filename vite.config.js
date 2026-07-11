import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }

          // Big libraries get their own chunk so a change in one doesn't
          // invalidate the browser cache for the others.
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }

          if (id.includes('framer-motion') || id.includes('motion-')) {
            return 'motion';
          }

          if (id.includes('react')) {
            return 'react';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const clientIp = req.socket?.remoteAddress;
            if (!clientIp) return;
            const normalized = clientIp.startsWith('::ffff:') ? clientIp.slice(7) : clientIp;
            const existing = req.headers['x-forwarded-for'];
            proxyReq.setHeader(
              'X-Forwarded-For',
              existing ? `${existing}, ${normalized}` : normalized,
            );
          });
        },
      },
    },
  },
});
