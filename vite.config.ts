import { defineConfig } from 'vite';

// Relative base so the build works when uploaded to itch.io or GitHub Pages subpaths.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    // The project lives on the Windows drive (/mnt/c); WSL doesn't get file-change events there.
    watch: { usePolling: true, interval: 300 },
  },
});
