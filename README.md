# Physarum Pathfinder

An interactive browser simulation and research workbench for how *Physarum polycephalum*
(slime mold) self-organizes adaptive transport networks across **six domains**:

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
4. **Factory FJSP · Two-Level Multi-Cell Jewelry Scheduling** — Upper-layer directed
   7-stage Physarum cell-flow balancing (`Wax → Casting → Filing → Setting → Polish → Plating → QC`)
   coupled via bottleneck shadow prices `λ_e` and machine disruptions (`Cut Edge`) to a
   Lower-layer discrete non-overlapping active FJSP Gantt decoder (with alloy setup
   changeovers, inter-zone transfers, re-entrant polishing, independent verification, and
   warm-started **OR-Tools CP-SAT `.py`** / **Schedule `.json`** exports), plus 300-PO
   wax-mold planning and the 20-cell [`factory.html`](factory.html) dispatch workbench.
5. **GraphRAG · Multi-Hop Evidence Verification** — deterministic multi-terminal `Q_rms`
   evidence flow with shadow-price `λ_e` hub penalties vs Personalized PageRank (`PPR`),
   `T04` room-scope isolation, `Cut Edge` requirement gap checks (`Ready` vs `Needs review`),
   and **Export Evidence (`.json`)**.
6. **Systems · Control-Plane Router** — live capacity-aware traffic & backpressure routing
   (`λ_e`) across Smart Payment Orchestration (`PromptPay` / `Omise` / `2C2P` / `Stripe`),
   Multi-Region LLM/GPU Gateway, Distributed ETL Worker Pools, Hybrid Edge–Fog–Cloud, Envoy
   Microservice Mesh Backpressure, and DB Read-Replica & Analytics Query Router, with an
   interactive **Condition Builder** (`Load ×`, `u_e`, extra cost, rail kill), live Physarum
   vs Static Router chart, and **Export Routing (`.json`)**.

**Live app:** <https://santapong.github.io/physarum/>

## Try it

1. Switch between the six lab tabs (**Transport Networks**, **Vascular & Soft Robotics**,
   **Optimization & Analog LP**, **Factory FJSP · Two-Level**, **GraphRAG · Multi-Hop Evidence**,
   and **Systems · Control-Plane**) or pick one of the **26 presets**:
   - *Transport:* Direct route, River crossing, City ring, Supply web, Tokyo Rail · Tero 2010, Bangkok Metro · Multi-Terminal
   - *Vascular:* Tissue Scaffold · Murray Tree, Cold Plate · Heat-Sink Cooling, Soft Actuator · 4-Finger Pneumatic
   - *Optimization:* Shortest Path · Bonifaci 2012, Capacitated Min-Cost Flow · LP, Resistor Crossbar · Analog Solver
   - *Factory FJSP:* Jewelry Atelier · 7-Stage Multi-Cell, Bridal Pavé Rush · High-Bottleneck, 100-PO Factory · FG + SG Multi-Model, 300-PO Factory · Model-specific routes, 300-PO Factory · Halo standby mold, ERP Master Scheduler · SO→PO + MRP + Cash Flow (`560 min/day` shift calendar, `SO → multi-PO`, `SG → Warehouse → Assembly → FG`, MRP material gating, and daily Cash Flow)
   - *GraphRAG:* Tender-B2B · Industrial Sensors (20 pcs), Tender-B2B · Salon Check-in (B1/C5 Gap)
   - *Systems Control-Plane:* Smart Payment Orchestration · FinTech, Multi-Region LLM / GPU Gateway, Distributed ETL · OCR & Embedding Pool, Hybrid Edge–Fog–Cloud Offloading, Microservice Mesh Backpressure · Envoy, DB Read-Replica & Analytics Query Router
2. Click **Run** (or toggle **Auto-stop when converged** under **Dynamics**) and watch paths prune, bifurcate, settle to LP optima, drive the live Gantt schedule, or absorb surge traffic.
3. Paint light/obstacle zones, use **Cut Edge** to test self-healing rerouting, **Cap Edge (0.55)** to toggle flow bottlenecks, or the **Condition Builder** in Systems Lab.
4. Export results via **Copy link** (`v1`/`v2`/`v3` `#state=` URLs), **Export PNG**,
   **Export CSV**, **Export SVG (CAD)**, **Export OpenSCAD**, **Export SPICE (.cir)**,
   **Export CP-SAT (.py)**, **Export Schedule (.json)**, **Export Evidence (.json)**,
   or **Export Routing (.json)**.

In **Factory FJSP**, open **PO routing & operation times** below the Gantt chart.
Choose a production order, enter its processing minutes for each eligible cell, and
use **Include plating** to add or skip the bath before QC on a finished order.
Semi-finished stock follows its existing route. **Apply to schedule** updates both
plans and their exports. The bath counts and processing minutes follow the displayed
plan and exclude setup time. Use **Copy link** to reopen your edited routes.

The **300-PO Factory** preset has 50 orders for each of six model routes.
In this synthetic example, PO-001 and PO-002 are the same plain cast band. Both
arrive ready for filing, then go to polishing and QC. Their filing times are
5 and 2 minutes respectively. Each remaining operation also has its own PO times.
Other models use plating, stone setting, full casting or stock replenishment.
In the 300-PO preset, each wax lot reserves one model-specific injection mold and a
wax station for its full PO processing time. Shots per lot are pieces divided by
cavities, rounded up. Each shot spends a cycle of the mold's starting budget.
The capacities, cycle times and remaining life in this preset are synthetic inputs.
The mold table shows the projected balance. A shortage makes the batch infeasible.
While this larger batch is running, the live schedule uses the dispatch heuristic;
pausing applies the same local refinement used for exports.

**Test Halo standby mold** repeats the same 300 orders with 90 shots left on the
primary Halo mold and 60 on a compatible spare. The scheduler uses the primary
until its last shot, then switches at a shot boundary, including within a PO.
Both molds have one cavity and identical cycle times. Changeover time is zero
in this trial. The mold table and exported schedule identify the physical tools
used by each plan.

### 20-cell factory production plan

Open **20-cell plan · Cash flow & materials** from the Factory FJSP Gantt, or
open `factory.html` in the running app. The finite-capacity dispatch plan uses the
six 300-PO model routes with 20 pieces per PO. Each PO has a home cell and
piece-specific labor rates can be edited per PO. Each normal cell has three
filers, three polishers and two QC staff. Gold uses cells 1–10, other sample
metals (silver, bronze and brass) use cells 11–20. Setting uses cell 21; its
staff count is an editable assumption. Casting capacity is shared at 2,000 pieces
per 560-minute shift. Compatible pieces from multiple orders fill 50-piece
plating or 200-piece tumbling batches. The default cycle times vary by alloy
within 10–20 and 60–120 minutes respectively. The plan uses one bath and one barrel.

Mold life is measured in shots. Initial Halo inventory has 90 primary and
60 standby shots. The default permits purchases of replacement molds and gates
their use on receipt. Material purchases gate the operation that consumes each item.
Daily cash includes customer deposits, collections after shipment, purchases,
paid resource hours and overhead. Internal mounting POs are issued to dependent
finished orders. Cash, prices, BOM weights, opening inventories and supplier
terms are synthetic planning assumptions. A negative balance shows the funding
gap; the simulator continues the production projection. The JSON export contains
the resource bookings, daily ledgers, PO receipts and physical mold usage.

The **Incoming PO & gold storage trial** compares the original plan, the same
300 orders with a storage ceiling, and an unannounced cast-solitaire PO added
during production. The default is 2,000 g of 18K-Y grain and 20 pieces arriving
on day 3, 120 minutes into the shift. The second plan supplies the execution
history for the third. Reservations already started (including in-progress
batches) finish on their original stations. Remaining pieces are rescheduled.
The supplier holds 400 g lots until the warehouse has room at the
start of a day. The daily inventory shows the balance immediately after receipt
and before issue. Use **Show original 300 POs** to return to the original plan.

**Cash flow → 18K-Y supplier payment comparison** prices the same scheduled
receipts under order-day and delivery-day payment. The chart, purchase ledger
and JSON export follow the selected terms. Other materials and tools are paid
on order. Minimum opening cash covers the deepest cumulative daily deficit;
additional funding is the gap after the entered opening balance.

**Purchasing & shipment timing** compares release-date buying with staged MRP
for the same orders. Staged buying first reads the planned PO start and first
use of each material from a feasible reference schedule. It reserves available
inventory, then orders uncovered quantities in supplier lots on the latest of
the PO announcement, planned PO start, and target operation day minus lead time.
A first-operation shortage can therefore delay the actual start. Replacement
molds are ordered by the same rule against their first planned use. Receipts
gate production; shipments follow completion of each finished PO and collections
follow its shipping date. At the PO-301 arrival, previous procurement commitments
and work in progress are retained. The purchasing calendar shows order, receipt,
payment and dispatch separately. Both purchase policies support either 18K-Y
payment term.

## Controls & Overlays

| Control / Tool | Result |
|---|---|
| Domain tabs | Switch between Transport, Vascular/Soft Robotics, Optimization/Analog LP, and Factory FJSP |
| Run / Pause / Step / Restart / Clear | Control adaptation and reset to seeded start |
| Dynamics rule | Choose `Tero Saturating (2010)`, `Murray Vascular (r⁴)`, or `Linear LP (Bonifaci / SV)` |
| Flow model / Graph substrate | Switch `Source → Sink` vs `Multi-Terminal`, and `Complete` / `Delaunay` / `Factory DAG (Explicit)` |
| Junction / Source / Sink | Place nodes (`Shift+click` = Source/Inlet, `Alt+click` = Sink/Outlet) |
| Cut Edge / Cap Edge (0.55) | Sever a live tube / offline a factory cell (`D = 0`) or toggle edge bottleneck capacity |
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

The test suite covers deterministic PRNG,
complete, Delaunay, and explicit factory DAG builders, Jacobi-PCG pressure solving,
semi-implicit Tero / Murray / primal-dual Linear LP dynamics, vascular Murray-Law & CAD
export, exact SSAP min-cost flow & SPICE export, Two-Level Multi-Cell Jewelry FJSP
(100-PO FG+SG BOM scheduling, 300-PO model routes and 560 min/day ERP Master Scheduler, Warehouse round-trip, MRP,
and Cash Flow) & CP-SAT export, Kruskal/Dijkstra transport metrics, terrain masking,
all 18 presets, and shared-state `v1`/`v2`/`v3` validation.

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
4. In **Factory FJSP · Two-Level**, `solveTwoLevelFjsp` reads Upper-layer cell loads `Q_e`,
   shadow prices `λ_e`, and offline cells (`Cut Edge`), decodes an active non-overlapping
   multi-cell schedule with alloy setups, inter-zone transfers, and re-entrant polishing,
   refines along the critical path, and verifies 0 constraint violations.

See [SPEC.md](./SPEC.md) for the base specification and [CHANGELOG.md](./CHANGELOG.md)
for release history.

## Source layout

```text
src/
|-- main.ts       Unified 4-lab UI controls, domain metrics, exports, animation loop
|-- graph.ts      Complete/Delaunay/Explicit DAG builders, edge sever/hover/capacity helpers
|-- solver.ts     Per-component Jacobi-PCG pressure solver & shared flow normalization
|-- sim.ts        Semi-implicit Tero, Murray vascular, and primal-dual Linear LP dynamics
|-- vascular.ts   Murray's Law / shear / hydraulic metrics and SVG + OpenSCAD CAD exports
|-- optimize.ts   Exact SSAP min-cost flow baseline, Lyapunov/crossbar metrics, SPICE export
|-- fjsp.ts       Two-Level Multi-Cell Jewelry FJSP solver, 560m/d shift calendar, CP-SAT export
|-- mrp.ts        ERP SO->PO hierarchy, SG Warehouse ledger, MRP gating, and daily Cash Flow engine
|-- metrics.ts    Kruskal MST, TL/MST, MD, fault tolerance (FT) metrics
|-- terrain.ts    90x60 light/obstacle cost grid and image-luminance mapper
|-- render.ts     Domain-aware canvas renderer, N×N crossbar heatmap, FJSP Gantt & Cash Flow chart
|-- presets.ts    18 scenarios across Transport, Vascular, Optimization, and Factory FJSP
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
