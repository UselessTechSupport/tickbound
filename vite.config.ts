import { defineConfig } from 'vite';

// Relative base so the build works when uploaded to itch.io or GitHub Pages subpaths.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    // Polling keeps hot reload working when the project sits on a Windows drive under WSL.
    watch: { usePolling: true, interval: 300 },
  },
});
