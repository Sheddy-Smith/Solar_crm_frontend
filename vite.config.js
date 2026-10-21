import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import tailwindcss from '@tailwindcss/vite';

// Android 8.1 System WebView / Chrome ~61 and the Malwa Solar TWA
// (WebViewFallbackActivity) must be able to parse the bundle. Vite's default
// baseline emits optional chaining / private fields that crash those engines
// on first paint — which is the "failed to start several times" loop.
const LEGACY_TARGETS = ['Android >= 5', 'Chrome >= 61', 'iOS >= 11', 'Safari >= 11', 'Firefox >= 60'];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: LEGACY_TARGETS,
      // Chrome 61–89 support type=module but not ?. / #fields — polyfill the
      // modern chunk path so the TWA/WebView does not load a SyntaxError.
      modernPolyfills: true,
      renderLegacyChunks: true,
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  build: {
    // Keep the modern chunk itself reasonably old-friendly when browsers pass
    // the module gate but still choke on newer syntax without polyfills.
    target: ['es2018', 'chrome70', 'safari12', 'firefox70', 'edge79'],
    cssTarget: 'chrome61',
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
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
