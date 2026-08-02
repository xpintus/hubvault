import react from '@vitejs/plugin-react';
import { fileURLToPath,URL } from 'node:url';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        cashCalculator: fileURLToPath(new URL('./cash-calculator.html', import.meta.url)),
        hubvaultSoftware: fileURLToPath(new URL('./hubvault-software.html', import.meta.url)),
        codReconciliation: fileURLToPath(new URL('./cod-reconciliation.html', import.meta.url)),
        dailyClosingSoftware: fileURLToPath(new URL('./daily-closing-software.html', import.meta.url)),
        logisticsCashCollectionSoftware: fileURLToPath(new URL('./logistics-cash-collection-software.html', import.meta.url)),
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          excel: ['xlsx'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
