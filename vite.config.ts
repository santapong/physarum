import { defineConfig } from 'vite';

// Set base to "/<repo-name>/" for GitHub Pages project sites.
// Override via BASE_PATH env var (the deploy workflow sets it from the repo name).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { rollupOptions: { input: { lab: 'index.html', factory: 'factory.html' } } },
});
