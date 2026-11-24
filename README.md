# Physarum Pathfinder

An interactive browser simulation and learning lab for how *Physarum polycephalum*
(slime mold) self-organizes into fault-tolerant, low-cost transport networks. It
implements the Tero et al. (2010) conductivity model on complete or Delaunay graph
substrates with both `Source → Sink` and `Multi-Terminal (Tero 2010)` dynamics.

**Live app:** <https://santapong.github.io/physarum/>

## Try it

1. Choose one of the six scenarios (**Direct route**, **River crossing**, **City ring**,
   **Supply web**, **Tokyo Rail · Tero 2010**, or **Bangkok Metro · Multi-Terminal**) or
   place your own terminals and junctions.
2. Select **Run** and watch weak detours prune while high-flux corridors strengthen.
3. Move `μ` below 1 for resilient mesh redundancy, or above 1 for sparse tree-like routes.
4. Paint light/obstacle zones, switch to **Cut Edge** to test self-healing rerouting,
   hover any tube to inspect its live Tero equation, and use **Copy link**, **Export PNG**,
   or **Export CSV** to save results.

## Controls & Overlays

| Control / Tool | Result |
|---|---|
| Run / Pause / Step / Restart / Clear | Control adaptation and reset to seeded start |
| Flow model | Switch `Source → Sink` vs `Multi-Terminal (Tero 2010)` |
| Graph substrate | Switch between `Complete graph` and `Delaunay mesh` |
| Junction / Source / Sink | Place nodes (`Shift+click` = Source/Food, `Alt+click` = Sink) |
| Cut Edge | Sever a live tube (`D = 0`) to observe bypass regrowth |
| Paint Light / Erase Light | Paint or clear high-cost terrain/light barriers |
| `μ`, `Δt`, Steps/frame | Tune feedback nonlinearity, step size, and animation speed |
| Inspect overlays | Toggle **MST baseline**, **Pressure & flow pulses**, **Station labels**, and **Map brightness → obstacle** |
| Copy link / Export PNG / Export CSV | Share v1/v2 `#state=` URLs, save canvas PNG, or download metrics CSV |

## Develop and validate

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

The test suite includes **32 unit tests across 8 test files** covering deterministic PRNG,
complete and Delaunay graph builders, Jacobi-PCG pressure solving, semi-implicit
adaptation and self-healing, Kruskal/Dijkstra network metrics, terrain masking,
all 6 presets, and shared-state v1/v2 validation.

## Run with Docker

```bash
docker compose up -d --build
# App:    http://127.0.0.1:8080/
# Health: http://127.0.0.1:8080/healthz
```

## Algorithm

Each simulation step:

1. Solves the grounded weighted Laplacian `L' p' = b'` per connected component using
   Jacobi-preconditioned Conjugate Gradient (`solvePressuresDetailed`).
2. Computes edge flow `Q = (D / (length * costFactor)) (p_i - p_j)` (or RMS flow across
   sampled terminal pairs in `multi-terminal` mode).
3. Updates conductivity via unconditionally stable semi-implicit integration:
   `D ← (D + Δt · (|Q|^μ / (1 + |Q|^μ))) / (1 + Δt)`, clamped to `[1e-5, 1]` on
   unsevered filaments.

See [SPEC.md](./SPEC.md) for the base specification and [CHANGELOG.md](./CHANGELOG.md)
for release history.

## Source layout

```text
src/
|-- main.ts       UI controls, tools, metrics strip, learning demos, animation loop
|-- graph.ts      Complete and Delaunay graph builders, edge sever/hover helpers
|-- solver.ts     Per-component Jacobi-PCG pressure solver with warm start
|-- sim.ts        Semi-implicit Tero dynamics (source-sink and multi-terminal)
|-- metrics.ts    Kruskal MST, TL/MST, MD, fault tolerance (FT) metrics
|-- terrain.ts    90x60 light/obstacle cost grid and image-luminance mapper
|-- render.ts     Canvas renderer with terrain, MST, pressure, flow, label layers
|-- presets.ts    6 scenarios including Tokyo Rail (with Tokyo Bay) and Bangkok Metro
|-- random.ts     Seeded PRNG
`-- state.ts      Versioned v1/v2 share-state validation and serialization
```

## References

- Tero, A. et al. (2010). *Rules for biologically inspired adaptive network
  design.* Science 327(5964), 439-442.
- Bonifaci, V., Mehlhorn, K., & Varma, G. (2012). *Physarum can compute shortest
  paths.* Journal of Theoretical Biology 309, 121-133.
- Straszak, D., & Vishnoi, N. K. (2016). *Natural algorithms for flow problems.*
  SODA 2016.
