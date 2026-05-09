# Physarum Pathfinder — Project Specification

A browser-based simulation of *Physarum polycephalum* (slime mold) self-organizing
into near-optimal transport networks between user-placed source/sink nodes.
Implementation of the Tero et al. (2010) adaptation model.

---

## Definition of Done (Day 1)

- [ ] User clicks empty canvas → places a node (gray, internal)
- [ ] Shift-click on canvas → places a source node (green)
- [ ] Alt-click on canvas → places a sink node (red)
- [ ] "Run" button starts the simulation
- [ ] Surviving high-conductivity edges visibly emerge as the system converges
- [ ] `μ` slider (range [0.5, 2.0]) live-adjusts network character
- [ ] `Reset` button clears nodes and edges
- [ ] Simulation maintains ≥ 30 fps for ≤ 50 nodes on a complete graph

---

## Stack — Locked

- **Vite + TypeScript** (vanilla template, no framework)
- **Canvas 2D** for rendering
- **No external math libraries** — the solver is hand-rolled
- **No UI library** — plain HTML `<input type="range">` and `<button>`

Scaffold:

```bash
npm create vite@latest . -- --template vanilla-ts
npm install
```

---

## File Structure — Locked

```
src/
├── main.ts        # Entry, UI controls, animation loop
├── graph.ts       # Node/Edge types, complete graph builder
├── solver.ts      # Conjugate gradient sparse Laplacian solver
├── sim.ts         # Tero dynamics step
└── render.ts      # Canvas drawing
```

Do **not** add `utils/`, `types/`, `components/`, or any further nesting.

---

## Data Types

```typescript
// graph.ts
export interface Node {
  id: number;
  x: number;
  y: number;
  flow: number;       // +1 = source, -1 = sink, 0 = internal
}

export interface Edge {
  i: number;          // node index, i < j
  j: number;
  length: number;     // Euclidean distance, fixed at creation
  D: number;          // conductivity, evolves in [0, 1]
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  adj: number[][];    // adj[nodeId] = list of edge indices touching that node
}
```

---

## Algorithm — Tero Adaptive Network Model

Per simulation tick, perform the following three steps in order.

### Step 1 — Solve for node pressures

Build the weighted graph Laplacian `L`:

- `L[i][i] = Σ (D_e / length_e)` over edges `e` incident to node `i`
- `L[i][j] = -(D_e / length_e)` if edge `e = (i, j)` exists, else 0

The matrix is **singular** (the constant vector is in its nullspace). To get a
unique solution, **ground node 0**: set `p[0] = 0`, remove its row and column
from the system, and solve the reduced `(N-1) × (N-1)` system

```
L' · p' = b'
```

where `b[k] = node[k].flow`.

Use **conjugate gradient** (sparse, symmetric positive-definite after grounding).

### Step 2 — Compute edge flows

For each edge `e = (i, j)`:

```
Q_e = (D_e / length_e) · (p_i - p_j)
```

### Step 3 — Update conductivities

Saturating adaptation function:

```
f(Q) = |Q|^μ / (1 + |Q|^μ)
```

Forward Euler update with time step `Δt`:

```
D_e ← D_e + Δt · ( f(|Q_e|) - D_e )
```

`f` saturates at 1, so `D ∈ [0, 1]` automatically. **No renormalization step
needed.** Do not add one.

---

## Default Parameters

| Parameter           | Value                              | Notes                                       |
|---------------------|------------------------------------|---------------------------------------------|
| `μ` (mu)            | `1.2`                              | <1 = mesh-like, >1 = tree-like              |
| `Δt`                | `0.05`                             | Time step                                   |
| `D_init`            | `0.5 + 0.1 · (random() - 0.5)`     | Symmetry-breaking noise required            |
| Source/sink flow    | Normalize so `Σ\|sources\| = 1`     | And `Σ\|sinks\| = -1`                        |
| Substeps per frame  | `8`                                | Smooths animation                           |
| CG max iterations   | `200`                              |                                             |
| CG tolerance        | `1e-6`                             | On `‖r‖`                                    |

---

## Conjugate Gradient Solver

```
function cg(matvec, b, x0, tol, maxIter):
  x = x0
  r = b - matvec(x)
  p = r
  rTr = dot(r, r)
  for k in 0..maxIter:
    Ap = matvec(p)
    alpha = rTr / dot(p, Ap)
    x += alpha * p
    r -= alpha * Ap
    rTrNew = dot(r, r)
    if sqrt(rTrNew) < tol: return x
    beta = rTrNew / rTr
    p = r + beta * p
    rTr = rTrNew
  return x
```

The `matvec(v)` operation must compute `L' · v` lazily using `adj[]`.
**Do not materialize the matrix.** With N nodes and E edges, `matvec` should be
O(E), not O(N²).

---

## Rendering

- Canvas 2D, single layer
- Clear each frame, redraw edges then nodes
- Edge stroke width: `lerp(0.5, 8, D)` pixels
- Edge alpha: `D` (low-D edges visibly fade)
- Node: filled circle, radius 6
  - Source: `#22c55e` (green)
  - Sink:   `#ef4444` (red)
  - Internal: `#9ca3af` (gray)
- Background: `#fafafa` (very pale)

---

## UI

```html
<canvas id="c" width="900" height="600"></canvas>
<div id="controls">
  <button id="run">Run</button>
  <button id="reset">Reset</button>
  <label>μ:  <input type="range" id="mu" min="0.5" max="2"   step="0.05" value="1.2"></label>
  <label>Δt: <input type="range" id="dt" min="0.01" max="0.2" step="0.01" value="0.05"></label>
</div>
<p id="hint">Click to place node · Shift+click = source · Alt+click = sink</p>
```

`μ` and `Δt` sliders should update the simulation **live** without a restart.

---

## Non-Goals (Day 1)

- ❌ Triangular mesh substrate (Day 2+)
- ❌ Real-map background overlay (Day 2+)
- ❌ Unit tests
- ❌ Tailwind, shadcn, or any styling library
- ❌ React, Vue, Svelte, or any framework
- ❌ Deployment / hosting setup
- ❌ `Float64Array`, WASM, or any premature optimization
- ❌ Additional files beyond the 5 in File Structure
- ❌ Routing, state management, or persistence

---

## Acceptance Test (manual)

1. Place 1 source + 1 sink + 5 internal nodes randomly distributed.
2. Click Run.
3. Within ~5 seconds of simulation time, the network should visibly prune:
   most edges fade to near-invisible, and a single dominant path between
   source and sink emerges (with possibly one or two redundant branches).
4. Drag `μ` slider down to 0.7 → the network should become more mesh-like
   (more surviving edges).
5. Drag `μ` up to 1.8 → the network should become more tree-like
   (fewer, sharper paths).

---

## References

- Tero, A., Takagi, S., Saigusa, T., Ito, K., Bebber, D. P., Fricker, M. D.,
  Yumiki, K., Kobayashi, R., & Nakagaki, T. (2010).
  *Rules for biologically inspired adaptive network design.*
  **Science**, 327(5964), 439–442.
- Bonifaci, V., Mehlhorn, K., & Varma, G. (2012).
  *Physarum can compute shortest paths.*
  **Journal of Theoretical Biology**, 309, 121–133.