import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { outDir: 'renderer', emptyOutDir: true, target: 'chrome140' } });
