# Physarum Pathfinder

An interactive browser simulation of how *Physarum polycephalum* (slime mold)
adapts into efficient transport networks. It implements the Tero et al. (2010)
conductivity model on complete or Delaunay graph substrates.

**Live app:** <https://santapong.github.io/physarum/>

## Try it

1. Choose one of the four scenarios or place your own source, sink, and junctions.
2. Select **Run** and watch weak routes disappear while useful paths strengthen.
3. Move `mu` below 1 for more redundancy, or above 1 for a sparser network.
4. Use **Copy link** to share the reproducible initial scenario or **Export PNG**
   to save the current canvas.

The seed controls the initial conductivity noise, so restarting or opening a
shared scenario produces the same starting network.

## Controls

| Control | Result |
|---|---|
| Run / Pause | Start or pause adaptation |
| Step | Advance by the selected number of substeps |
| Restart | Rebuild current nodes from their seeded initial conductivities |
| Clear | Remove all nodes and edges |
| Junction / Source / Sink | Select the node placed by the next canvas click |
| Shift-click / Alt-click | Quick source / sink placement |
| Graph substrate | Switch between complete and Delaunay graphs |
| Seed / New | Reproduce or randomize initial conductivities |
| Network character `mu` | Below 1 favors meshes; above 1 favors trees |
| Time step `dt` | Control adaptation size per substep |
| Steps per frame | Control simulation speed |
| Map layer | Add or remove a local background image |
| Copy link | Store nodes, dynamics, graph mode, and seed in the URL hash |
| Export PNG | Save the canvas, including its map layer |

## Develop and validate

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

The test suite covers deterministic randomness, complete and Delaunay graph
construction, pressure solving, conductivity adaptation, presets, and shared
state validation. Pull requests run tests and a production build; deployment to
GitHub Pages repeats both checks before publishing.

## Algorithm

Each simulation step:

1. Solves the grounded weighted Laplacian `L' p' = b'` for node pressures with a
   sparse conjugate-gradient implementation.
2. Computes edge flow `Q = (D / length) (p_i - p_j)`.
3. Updates conductivity with
   `D = D + dt (|Q|^mu / (1 + |Q|^mu) - D)` and clamps it to `[0, 1]`.

See [SPEC.md](./SPEC.md) for the model and [PLAN_V1.md](./PLAN_V1.md) for the v1
scope. The manual release checklist is in [ACCEPTANCE.md](./ACCEPTANCE.md).

## Source layout

```text
src/
|-- main.ts       UI controls and animation loop
|-- graph.ts      Complete and Delaunay graph builders
|-- solver.ts     Conjugate-gradient pressure solver
|-- sim.ts        Conductivity adaptation step
|-- render.ts     Canvas rendering
|-- presets.ts    Built-in scenarios
|-- random.ts     Seeded random generator
`-- state.ts      Share-state validation and serialization
```

## References

- Tero, A. et al. (2010). *Rules for biologically inspired adaptive network
  design.* Science 327(5964), 439-442.
- Bonifaci, V., Mehlhorn, K., & Varma, G. (2012). *Physarum can compute shortest
  paths.* Journal of Theoretical Biology 309, 121-133.
