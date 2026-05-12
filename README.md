# Physarum Pathfinder

Browser-based simulation of *Physarum polycephalum* (slime mold) self-organizing
into near-optimal transport networks. Implements the Tero et al. (2010)
adaptation model on either a complete graph or a Delaunay triangulation.

See [`SPEC.md`](./SPEC.md) for the full specification and algorithm details.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite (default http://localhost:5173).

## Controls

| Action            | Result                          |
|-------------------|---------------------------------|
| Click             | Place internal node (gray)      |
| Shift + click     | Place source (green)            |
| Alt + click       | Place sink (red)                |
| **Run** / Pause   | Start or pause the simulation   |
| **Reset**         | Clear all nodes and edges       |
| `μ` slider        | Mesh-like (<1) vs tree-like (>1)|
| `Δt` slider       | Time step per substep           |
| **Mode**          | Complete graph or Delaunay      |
| **Map**           | Load a background image         |

Stats line under the canvas shows live node count, edge count, and frames per second.

## Algorithm

Per simulation tick:

1. Solve the grounded weighted Laplacian `L'·p' = b'` for node pressures via
   conjugate gradient (sparse, no matrix materialization).
2. Compute edge flows `Q = (D/length) · (p_i − p_j)`.
3. Update conductivities `D ← D + Δt · (|Q|^μ / (1 + |Q|^μ) − D)`.

## Build

```bash
npm run build      # type-check + production bundle to dist/
npm run preview    # serve the built dist/
```

## Files

```
src/
├── main.ts      Entry, UI controls, animation loop
├── graph.ts     Types, complete + Delaunay graph builders
├── solver.ts    Conjugate gradient + grounded Laplacian solve
├── sim.ts       Tero dynamics step
└── render.ts    Canvas drawing
```

## References

- Tero, A. et al. (2010). *Rules for biologically inspired adaptive network design.*
  Science 327(5964), 439–442.
- Bonifaci, V., Mehlhorn, K., & Varma, G. (2012). *Physarum can compute shortest paths.*
  J. Theor. Biol. 309, 121–133.
