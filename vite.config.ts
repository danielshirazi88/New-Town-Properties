import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Emit a classic script rather than an ES module. Module scripts are subject
    // to CORS even when inline, so Safari refuses to run them from a file://
    // origin and the page renders blank — which is exactly what happens when
    // someone is handed the single-file build and opens it from their desktop.
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'assets/[name]-[hash].js' },
    },
  },
})
