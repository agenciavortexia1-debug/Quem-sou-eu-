import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  // Forçar otimização do PeerJS para compatibilidade
  optimizeDeps: {
    include: ['peerjs'],
  },
  // Definir global como window para bibliotecas antigas/compatibilidade
  define: {
    global: 'window',
  },
  server: {
    port: 3000
  }
});