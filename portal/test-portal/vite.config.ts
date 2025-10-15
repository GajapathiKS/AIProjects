import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4201,
    proxy: {
      '/api': 'http://localhost:4001',
      '/artifacts': 'http://localhost:4001',
      '/data/artifacts': 'http://localhost:4001'
    }
  }
});
