# Changelog

## 2.0.0 - 2026-11-24

- Added Jacobi-preconditioned Conjugate Gradient (`solvePressuresDetailed`) with per-connected-component grounding and optional warm-starting.
- Switched conductivity adaptation to unconditionally stable semi-implicit Euler integration with a `1e-5` living-filament floor for self-healing regrowth.
- Added Multi-Terminal Tero et al. (2010) mode with variance-normalized RMS flow (`I0 = 0.65 * sqrt(K / 2)`), plus **Tokyo Rail · Tero 2010** (with Tokyo Bay obstacle mask) and **Bangkok Metro · Multi-Terminal** presets.
- Added live Tero network metrics (`TL/MST`, `MD`, `FT`, PCG telemetry, and sparkline), live edge equation hover inspector, MST/pressure/flow/station-label overlays, Cut Edge & Paint/Erase Light tools, CSV export, and 4 interactive **Learn the Math & Experiments** cards.
- Added multi-stage non-root Docker and Docker Compose setup (`Dockerfile`, `docker-compose.yml`, `nginx.conf`, `.dockerignore`).
- Hardened shared-state validation to reject malformed non-object node entries cleanly.

## 1.0.0 - 2026-09-05

- Added deterministic seeded graph initialization and reproducible share links.
- Added Direct route, River crossing, City ring, and Supply web presets.
- Added explicit junction, source, and sink placement tools.
- Added pause, step, restart, clear, speed, status, and convergence feedback.
- Added PNG export and optional map-image backgrounds.
- Added a responsive, keyboard-visible interface and live canvas summary.
- Hardened degenerate geometry and numerical solver behavior.
- Added 13 core tests across six test files and CI validation before deployment.
