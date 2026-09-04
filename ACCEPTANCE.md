# Physarum Pathfinder v1.0 Acceptance

## Automated gates

- [x] `npm test` — 13 tests pass across six files.
- [x] `npm run build` — TypeScript and the production Vite bundle succeed.
- [x] `npm audit --audit-level=high` — no known vulnerabilities.
- [x] CI validates pull requests and feature branches.
- [x] Pages deployment tests and builds before publishing.

## Browser checks

- [x] Desktop: all four presets load; run, pause, step, and restart respond.
- [x] Narrow screen: controls stack without horizontal overflow at 390 px.
- [x] Placement tools create junction, source, and sink nodes.
- [x] Complete and Delaunay substrates build valid runnable graphs.
- [x] A copied link restores nodes, parameters, mode, and seed after reload.
- [x] PNG export produces a non-empty canvas image.
- [x] Keyboard focus has a visible high-contrast outline.
- [x] Reduced-motion users receive the same paused initial state.

Verified on 2026-09-05 with headless Chromium at 1440 px and 390 px. The browser
smoke test also checked all presets, placement, stepping, run/pause state,
share-state reload, and PNG download. Automated tests cover the underlying graph,
solver, dynamics, presets, randomness, and share-state logic.
