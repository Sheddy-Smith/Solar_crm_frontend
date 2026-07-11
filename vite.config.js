import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev` → plain HTTP (unchanged workflow).
// `npm run dev:https` → self-signed HTTPS, needed to test PWA install from
// other LAN devices (browsers only allow install on HTTPS or localhost).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'https' ? [basicSsl()] : [])],
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
}));
