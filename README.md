# Physarum Pathfinder

An interactive browser simulation and research workbench for how *Physarum polycephalum*
(slime mold) self-organizes adaptive transport networks across **three domains**:

1. **Transport Networks (Tero et al. 2010)** — fault-tolerant, low-cost routing on complete
   or Delaunay substrates (`Source → Sink` and `Multi-Terminal`).
2. **Vascular, Microfluidics & Soft Robotics** — Hagen–Poiseuille (`D ∝ r⁴`) channel
   remodeling obeying **Murray's Law** (`r_p³ = Σ r_c³`), wall shear stress inspection,
   and 1:1 millimeter **SVG / OpenSCAD** CAD export for tissue scaffolds, heat-sink cold
   plates, and pneumatic soft actuators.
3. **Mathematical Optimization & Analog LP** — continuous **Bonifaci et al. (2012)** &
   **Straszak–Vishnoi (2016)** Linear Physarum mirror descent for Shortest Path,
   primal-dual Capacitated Min-Cost Flow, live exact SSAP optimality gap, `N×N`
   resistor-crossbar conductance heatmap, and **SPICE (`.cir`)** netlist export.

**Live app:** <https://santapong.github.io/physarum/>

## Try it

1. Switch between the three lab tabs (**Transport Networks**, **Vascular & Soft Robotics**,
   and **Optimization & Analog LP**) or pick one of the **12 presets**:
   - *Transport:* Direct route, River crossing, City ring, Supply web, Tokyo Rail · Tero 2010, Bangkok Metro · Multi-Terminal
   - *Vascular:* Tissue Scaffold · Murray Tree, Cold Plate · Heat-Sink Cooling, Soft Actuator · 4-Finger Pneumatic
   - *Optimization:* Shortest Path · Bonifaci 2012, Capacitated Min-Cost Flow · LP, Resistor Crossbar · Analog Solver
2. Click **Run** and watch paths prune, bifurcate, or settle to exact LP flow optima.
3. Paint light/obstacle zones, use **Cut Edge** to test self-healing rerouting, or
   **Cap Edge (0.55)** to toggle flow bottlenecks in Optimization mode.
4. Export results via **Copy link** (`v1`/`v2`/`v3` `#state=` URLs), **Export PNG**,
   **Export CSV**, **Export SVG (CAD)**, **Export OpenSCAD**, or **Export SPICE (.cir)**.

## Controls & Overlays

| Control / Tool | Result |
|---|---|
| Domain tabs | Switch between Transport, Vascular/Soft Robotics, and Optimization/Analog LP |
| Run / Pause / Step / Restart / Clear | Control adaptation and reset to seeded start |
| Dynamics rule | Choose `Tero Saturating (2010)`, `Murray Vascular (r⁴)`, or `Linear LP (Bonifaci / SV)` |
| Flow model / Graph substrate | Switch `Source → Sink` vs `Multi-Terminal`, and `Complete` vs `Delaunay` |
| Junction / Source / Sink | Place nodes (`Shift+click` = Source/Inlet, `Alt+click` = Sink/Outlet) |
| Cut Edge / Cap Edge (0.55) | Sever a live tube (`D = 0`) or toggle edge bottleneck capacity |
| Paint Light / Erase Light | Paint or clear high-cost terrain/obstacle keep-out zones |
| Inspect overlays | Toggle **MST baseline**, **Pressure & flow pulses**, **Station/port labels**, **Wall shear heatmap**, **Exact OPT baseline**, **Capacity labels**, and **Map brightness → obstacle** |

## Develop and validate

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

The test suite includes **41 unit tests across 10 test files** covering deterministic PRNG,
complete and Delaunay graph builders, Jacobi-PCG pressure solving, semi-implicit Tero /
Murray / primal-dual Linear LP dynamics, vascular Murray-Law & CAD export, exact SSAP
min-cost flow & SPICE export, Kruskal/Dijkstra transport metrics, terrain masking, all
12 presets, and shared-state `v1`/`v2`/`v3` validation.

## Run with Docker

```bash
docker compose up -d --build
# App:    http://127.0.0.1:8080/
# Health: http://127.0.0.1:8080/healthz
```

## Algorithm

Each simulation step:

1. Solves the grounded weighted Laplacian `L' p' = b'` per connected component using
   Jacobi-preconditioned Conjugate Gradient (`solvePressuresDetailed`) with conductance
   `G_e = D_e / (c_e · (1 + λ_e))`.
2. Computes edge flow `Q_e = G_e (p_i - p_j)` (or RMS flow across sampled pairs in
   `multi-terminal` mode).
3. Updates conductivity via semi-implicit integration (`D ← (D + Δt · target) / (1 + Δt)`):
   - **Tero:** `target = |Q|^μ / (1 + |Q|^μ)`
   - **Murray:** `target = min(1, |Q|^μ)` (`μ = 4/3` yields `r_p³ = Σ r_c³` and uniform shear)
   - **Linear LP:** `target = |Q|`, paired with predictive-damped dual update
     `λ_e ← clip(λ_e + 2 Δt (|Q_e| + 0.8 (|Q_e| - D_e) - u_e))` on capacitated edges.

See [SPEC.md](./SPEC.md) for the base specification and [CHANGELOG.md](./CHANGELOG.md)
for release history.

## Source layout

```text
src/
|-- main.ts       Unified 3-lab UI controls, domain metrics, exports, animation loop
|-- graph.ts      Complete/Delaunay builders, edge sever/hover/capacity helpers
|-- solver.ts     Per-component Jacobi-PCG pressure solver & shared flow normalization
|-- sim.ts        Semi-implicit Tero, Murray vascular, and primal-dual Linear LP dynamics
|-- vascular.ts   Murray's Law / shear / hydraulic metrics and SVG + OpenSCAD CAD exports
|-- optimize.ts   Exact SSAP min-cost flow baseline, Lyapunov/crossbar metrics, SPICE export
|-- metrics.ts    Kruskal MST, TL/MST, MD, fault tolerance (FT) metrics
|-- terrain.ts    90x60 light/obstacle cost grid and image-luminance mapper
|-- render.ts     Domain-aware canvas renderer & N×N crossbar matrix heatmap
|-- presets.ts    12 scenarios across Transport, Vascular/Soft Robotics, and Optimization
|-- random.ts     Seeded PRNG
`-- state.ts      Versioned v1/v2/v3 share-state validation and serialization
```

## References

- Tero, A. et al. (2010). *Rules for biologically inspired adaptive network
  design.* Science 327(5964), 439-442.
- Murray, C. D. (1926). *The physiological principle of minimum work.* PNAS 12(3), 207-214.
- Hu, D., & Cai, D. (2013). *Adaptation and optimization of biological transport
  networks.* Physical Review Letters 111(13), 138701.
- Bonifaci, V., Mehlhorn, K., & Varma, G. (2012). *Physarum can compute shortest
  paths.* Journal of Theoretical Biology 309, 121-133.
- Straszak, D., & Vishnoi, N. K. (2016). *Natural algorithms for flow problems.*
  SODA 2016.
