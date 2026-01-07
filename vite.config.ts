import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative paths for assets
  build: {
    outDir: 'dist', // The folder name for your production files
    minify: 'terser', // Uses Terser for advanced obfuscation
    sourcemap: false, // CRITICAL: Disables mapping back to your TS source
    terserOptions: {
      compress: {
        drop_console: true, // Removes all console.logs
        drop_debugger: true, // Removes debugger statements
      },
      mangle: {
        toplevel: true, // Renames global variables to single letters
      },
      format: {
        comments: false, // Strips all comments
      },
    },
    rollupOptions: {
      output: {
        // Renames files to prevent browser caching of old versions
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
});