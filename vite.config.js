import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Permanent Android 8.1 / Chrome 61 support
 * -----------------------------------------
 * APK evidence (aapt on public/downloads/malwa-solar.apk):
 *   package            = com.ecomalwa.crm
 *   generator          = twa_generator (Bubblewrap / androidbrowserhelper)
 *   launch activity    = com.ecomalwa.crm.LauncherActivity
 *   DEFAULT_URL        = https://crm.ecomalwa.com/?source=twa
 *   FALLBACK_STRATEGY  = webview  → WebViewFallbackActivity
 *   minSdk             = 21
 *
 * When TWA/Chrome Custom Tabs cannot start, System WebView loads the site.
 * Un-updated Android 8.1 WebView is Chrome ~61 and cannot parse optional
 * chaining / nullish coalescing. That produces a startup failure loop
 * ("Malwa Solar failed to start several times"), not a CRM data problem.
 *
 * Build strategy (maintainable):
 *   1. @vitejs/plugin-legacy → Babel SystemJS legacy chunks for Chrome 61+.
 *   2. build.target = chrome61 → downlevel modern chunks / deps where possible.
 *   3. Per-release BUILD_ID stamped into sw.js so caches cannot pin stale HTML
 *      to missing hashed chunks across deploys.
 */

const LEGACY_TARGETS = ['Android >= 5', 'Chrome >= 61', 'iOS >= 11', 'Safari >= 11', 'Firefox >= 60'];
const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
const RELEASE_VERSION = String(pkg.version || '0.0.0');
const BUILD_ID = createHash('sha1')
  .update(`${Date.now()}-${process.env.GITHUB_SHA || RELEASE_VERSION}`)
  .digest('hex')
  .slice(0, 12);
const RELEASE_NOTES = String(
  process.env.MALWA_RELEASE_NOTES
    || 'Update CRM popup ab automatically aata hai jab naya web release deploy hota hai — installed mobile/desktop apps included, bina APK reinstall ke.',
);

function swBuildIdPlugin() {
  return {
    name: 'malwa-sw-build-id',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta name="malwa-build-id" content="${BUILD_ID}" />\n    <meta name="malwa-release-version" content="${RELEASE_VERSION}" />`,
      );
    },
    closeBundle() {
      const distDir = path.resolve('dist');
      const swPath = path.join(distDir, 'sw.js');
      if (fs.existsSync(swPath)) {
        const text = fs.readFileSync(swPath, 'utf8').replace(/__MALWA_BUILD_ID__/g, BUILD_ID);
        fs.writeFileSync(swPath, text);
      }
      const payload = {
        releaseVersion: RELEASE_VERSION,
        buildId: BUILD_ID,
        releaseNotes: RELEASE_NOTES,
        minBrowser: 'chrome61',
        apkPackage: 'com.ecomalwa.crm',
        twaFallback: 'webview',
        requiresApkUpdate: false,
        updateChannel: 'web',
        generatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(distDir, 'build-id.json'), `${JSON.stringify(payload, null, 2)}\n`);
      // version.json is the no-cache update probe (same payload; kept as a stable filename).
      fs.writeFileSync(path.join(distDir, 'version.json'), `${JSON.stringify(payload, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  // Relative base so the same build works on both:
  //   https://crm.ecomalwa.com/     (document root)
  //   https://ecomalwa.com/crm/     (subdirectory)
  // Absolute "/assets/..." breaks the /crm/ URL (resolves to ecomalwa.com/assets → 404).
  base: './',
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
    'import.meta.env.VITE_RELEASE_VERSION': JSON.stringify(RELEASE_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: LEGACY_TARGETS,
      modernPolyfills: true,
      renderLegacyChunks: true,
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
    swBuildIdPlugin(),
  ],
  build: {
    target: 'chrome61',
    cssTarget: 'chrome61',
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('framer-motion') || id.includes('motion-')) return 'motion';
          if (id.includes('react')) return 'react';
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
