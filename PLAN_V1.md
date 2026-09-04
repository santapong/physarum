# Physarum Pathfinder v1.0 Plan

## Outcome

A polished, deterministic, accessible browser simulation that lets a visitor load a compelling network preset, understand the adaptation process, adjust it, reproduce or share the state, and export the result.

## Definition of done

### Simulation integrity

- [x] Seeded edge initialization makes the same shared state reproduce the same network.
- [x] Complete and Delaunay graph modes remain supported.
- [x] Invalid or degenerate graph geometry cannot produce non-finite solver values.
- [x] Unit tests cover graph construction, pressure solving, adaptation, serialization, and presets.

### Interaction

- [x] Run/pause, single-step, reset, and clear controls.
- [x] Adjustable network character (`mu`), time step, and simulation speed.
- [x] A compact preset gallery with at least four meaningful examples.
- [x] Node placement works with pointer input; source and sink placement do not depend only on modifier keys.
- [x] Current parameter values and simulation status are visible.

### Reproduction and output

- [x] Copy-link action serializes nodes, parameters, graph mode, and seed into the URL hash.
- [x] Reloading a shared URL restores the same initial state.
- [x] PNG export includes the simulation and any uploaded map background.
- [x] A restart action reconstructs seeded conductivities instead of preserving evolved values.

### Presentation and accessibility

- [x] Responsive layout works on desktop and narrow mobile screens.
- [x] Controls use semantic labels and visible keyboard focus.
- [x] The page explains source, sink, conductivity, `mu`, and convergence without requiring the paper.
- [x] Reduced-motion preference pauses automatic simulation until the user starts it.
- [x] Canvas has an accessible text summary of the current graph.

### Delivery

- [x] `npm test` and `npm run build` pass.
- [x] GitHub Actions runs tests and build before Pages deployment.
- [x] README documents presets, sharing, export, controls, algorithm, and validation.
- [x] Package version is `1.0.0`; release notes and manual acceptance checklist are present.

## Implementation order

1. Make graph construction deterministic and robust.
2. Add serializable app state and tested presets.
3. Rebuild the compact responsive UI and explicit node-placement tool.
4. Add run/step/restart, parameter feedback, sharing, and PNG export.
5. Add test harness and core unit tests.
6. Update CI, README, version, and release notes.
7. Run automated and manual validation at desktop and mobile widths.

## Non-goals

- User accounts, cloud persistence, multiplayer, backend services, AI-generated layouts, routing, or a frontend framework.
- Exact biological modeling beyond the documented Tero adaptation model.
- Geographic optimization claims; the map is a visual substrate, not a road-aware solver.
