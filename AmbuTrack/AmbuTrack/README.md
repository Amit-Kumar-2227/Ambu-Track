# AmbuTrack

A student-friendly ambulance dispatch and tracking web project with a real **A* (A-star) pathfinding implementation**. Written in HTML, CSS and JavaScript. The frontend runs without a framework. A Firebase backend is included for cloud persistence; it needs your Firebase web configuration, Anonymous Authentication and Firestore. Until configured, it uses explicitly labelled local demo storage. See **FIREBASE_SETUP.md**.

## Run on Windows

1. Install Python 3 if it is not already available.
2. Extract the ZIP and open the `AmbuTrack` folder.
3. Double-click `start.bat`, or run `python serve.py` in a terminal.
4. Open **http://localhost:8000** in your browser.
5. Keep the terminal open; press Ctrl+C to stop.

On macOS/Linux run `python3 serve.py`. This server binds only to your own computer. Do not open `index.html` by double-clicking: the project uses JavaScript modules and needs the local HTTP server.

## Features

- Dispatcher dashboard and interactive SVG road map.
- Four ambulances with available/offline controls.
- Automatic ambulance selection by shortest **A* travel time to pickup**.
- Manual ambulance selection.
- Pickup and destination selection across eight pickup locations and three hospitals.
- Two-stage route: ambulance → pickup → hospital.
- Real A* pathfinding with simulated traffic weights and a road closure.
- Accelerated vehicle movement at 30× speed, pause/resume and cancellation.
- Hospital speciality filter and ranking by A* travel time.
- A* search trace with g, h and f values.
- Firebase Cloud Firestore persistence for fleet, hospitals, active-trip checkpoints, settings and the latest 100 trip records.
- Anonymous Authentication and per-user Firestore security rules.
- Explicit local-demo fallback before Firebase is configured, plus CSV export.
- Responsive layouts, labelled form controls and keyboard-accessible dialogs.

## Scope and limitations

This is a **working educational simulation**, not an emergency service. The Bhopal-inspired map is a fictional, hand-built road graph, not a geographically accurate street map. Hospitals, bed counts, crews, traffic, travel times and positions are demo data. The project does not contact ambulances or hospitals and has no real GPS or emergency-service backend. Its optional Firebase database stores isolated demo workspaces. Priority is a recorded label, not a medical triage system. Fleet type is descriptive and automatic assignment does not assess clinical suitability.

Fleet, history, settings and active-trip checkpoints persist in Firestore when configured, or localStorage in local mode. Reloaded trips start paused. Anonymous Firebase workspaces are scoped to the current browser identity, so different identities do not share records. Moving trips checkpoint every five seconds. Cancelling snaps the ambulance to its last reached network node. Historical distance/time fields describe the full planned route, not actual travel after cancellation. Only one simulated trip runs at a time. Background-tab throttling may slow the visual simulation.

Google Fonts is an optional visual dependency; system fonts are used when unavailable. The map, routing and tracking do not depend on external map APIs.

## Code structure

| File | Purpose |
|---|---|
| `dist/index.html` | Dashboard, fleet, hospitals, history, A* explorer and about views |
| `dist/styles.css` | Responsive styling |
| `dist/app.js` | UI, assignment, tracking simulation, persistence integration and export |
| `dist/backend.js` | Firebase Auth/Firestore adapter, local adapter and serialized save queue |
| `dist/state.js` | Data validation and active-trip checkpoint encoding/restoration |
| `dist/firebase-config.js` | Fill in your public Firebase web config here |
| `firestore.rules` | Owner-only database rules with revision checks |
| `firebase.json` | Firebase rules/hosting configuration |
| `FIREBASE_SETUP.md` | Backend connection and verification instructions |
| `dist/routing.js` | A* search, cost function and nearest-unit selection |
| `dist/data.js` | Graph, demo hospitals, pickup locations and fleet |
| `tests/routing.test.js` | Algorithm correctness tests |
| `serve.py` / `start.bat` | Local development launcher |
| `PROJECT_NOTES.md` | Explanation and presentation/viva notes |

## A* implementation

Each road junction is a node. Each road segment is an undirected edge. Edge weight is travel time in minutes:

`cost = distance_km / speed_kmh × 60 × traffic_multiplier`

Distance is Euclidean canvas distance scaled by 0.012 km per SVG unit. Demo speeds are 35 or 50 km/h. Traffic multipliers are always at least 1. The heuristic is straight-line time at the maximum speed:

`h(n) = straight_line_distance(n, goal) / 50 × 60`

The priority score is `f(n) = g(n) + h(n)`. A* repeatedly expands the lowest-score open node and relaxes its neighbours. It reconstructs the path using predecessor pointers. A blocked edge is omitted. Because the heuristic is a consistent lower bound for these weights, the returned route minimizes travel time on this graph. This is not necessarily the shortest distance.

The implementation uses a Set and a linear scan for the minimum, keeping the student code readable. It is intended for this small graph. A heap-based priority queue and a real road dataset are future improvements for larger networks.

## Tests

Install Node.js, then run:

```sh
npm test
```

The backend tests cover seeding, preserving existing data, stale-writer rejection, serialized writes, retry, and checkpoint restoration using an injected SDK mock. Live Firebase and security-rule enforcement have not yet been tested without your project configuration.

The routing test suite compares A* with Dijkstra (`h = 0`) across 528 source/destination/scenario combinations. It also verifies edge continuity, closed-road avoidance, no-path cases, same-node paths and unavailable-fleet handling.

Browser visual QA was unavailable in the build environment; the automated checks cover the routing logic, and JavaScript syntax.

## Deploy independently

The `dist` folder is the whole static website. Upload its contents to any static host. For GitHub Pages, put the contents of `dist` in the repository root or a configured `docs` folder and enable Pages for that folder. Use relative paths unchanged. Do not upload private credentials.

## Reference and attribution

Feature inspiration: [Lusan Sapkota / Ambulance-tracking-system](https://github.com/Lusan-sapkota/Ambulance-tracking-system). AmbuTrack is a new implementation rather than a renamed copy. No source code or visual assets were copied from the reference. It preserves the general booking/tracking/hospital-dashboard idea and adds A* as the central educational feature.
