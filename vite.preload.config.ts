import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    build: {
        target: 'node16',
        lib: {
            entry: path.resolve(__dirname, 'src/preload.ts'),
            formats: ['cjs'],
        },
        rollupOptions: {
            external: ['electron', 'fs', 'path', '@electron/remote'],
        },
        outDir: '.vite/build',
        emptyOutDir: false,
    },
});
