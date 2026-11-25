# Changelog

## 3.0.0 - 2026-11-25

- Added **Vascular, Microfluidics & Soft Robotics** lab (`murray` power-law dynamics with Hagen–Poiseuille `D ∝ r⁴` scaling, Murray's Law & wall shear stress metrics/heatmap, **Tissue Scaffold**, **Cold Plate**, and **Soft Actuator** presets, plus 1:1 mm SVG and parametric OpenSCAD CAD exports).
- Added **Mathematical Optimization & Analog LP** lab (`linear-lp` Bonifaci/Straszak–Vishnoi mirror-descent dynamics with predictive-damped primal-dual congestion multipliers, exact SSAP baseline & Lyapunov energy tracking, **Cap Edge** bottleneck tool, `N×N` crossbar conductance heatmap, **Shortest Path**, **Capacitated Min-Cost Flow**, and **Resistor Crossbar** presets, plus SPICE `.cir` netlist export).
- Added unified 3-lab domain tabs, `v3` share-state serialization (preserving `v1`/`v2` compatibility), 6 interactive **Learn the Math & Experiments** cards, and expanded the suite to 41 unit tests across 10 test files.

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
