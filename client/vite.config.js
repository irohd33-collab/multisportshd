import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacyPlugin from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    legacyPlugin({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      modernPolyfills: true,
    }),
  ],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    // TV tarayıcıları (Tizen/WebOS/Android TV) eski JS motorları kullanır:
    // es2015 hedefi nullish (??), optional chaining (?.) ve ok fonksiyonlarını
    // tamamen dönüştürür — aksi halde TV'de script çöker, sadece arka plan görünür.
    target: 'es2015',
  },
});
