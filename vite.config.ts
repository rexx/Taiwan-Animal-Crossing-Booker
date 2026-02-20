import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 使用相對路徑以確保在 GitHub Pages 的子路徑下能正常運作
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
