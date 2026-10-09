# AmbuTrack — project explanation

## Problem statement

Ambulance dispatch requires choosing an available vehicle and finding a route to the patient and then a hospital. Road distance alone may not represent travel time when speeds, congestion and closures differ. AmbuTrack demonstrates this decision on a weighted road graph.

## Objective

Build an easy-to-understand web application that applies A* to minimize estimated travel time, visualizes the path and lets students demonstrate complete simulated ambulance trips.

## Modules

1. **Road graph:** 64 junctions, bidirectional edges, speed and congestion attributes.
2. **A* engine:** open set, g scores, heuristic, predecessor map and search trace.
3. **Dispatch:** finds the fastest available ambulance to the pickup, then calculates the hospital leg.
4. **Tracking:** advances a vehicle along each edge according to its travel-time weight.
5. **Fleet:** changes demo availability and prevents assignment of offline/on-trip units.
6. **Hospital finder:** filters fictional hospitals and sorts them by route time.
7. **History:** records completed/cancelled trips and exports CSV.

## Algorithm steps

1. Add the source to OPEN with g(source) = 0.
2. Select the open node with the smallest f = g + h.
3. If this is the destination, follow predecessor links to reconstruct the path.
4. For each connected neighbour, skip closed edges.
5. Calculate tentative g = current g + edge travel time.
6. If this is a better known route, store the new score and predecessor and add the neighbour to OPEN.
7. Repeat until the destination is found or OPEN is empty.

## Why A*?

Dijkstra explores based on travel cost already incurred. A* also uses a goal-directed lower-bound estimate. A* can expand fewer nodes while preserving optimality when the heuristic is admissible and the search is implemented correctly. It is not guaranteed to expand fewer nodes in every case, and performance depends on the graph and heuristic.

## Viva questions

**What are g, h and f?**
g is actual route cost from the source; h is estimated remaining cost; f is their sum. All three use minutes here.

**Why is this heuristic admissible?**
Straight-line distance cannot exceed the length of a road path. No road permits more than 50 km/h, and congestion only increases time. Dividing straight-line distance by 50 km/h therefore gives a lower bound.

**Is the fastest ambulance the geographically nearest one?**
Not necessarily. The dispatcher compares A* travel times, which include road connectivity and optional traffic.

**Does the project use Google Maps routing behind an A* label?**
No. The local `routing.js` implementation computes paths itself on the graph in `data.js`.

**What changes when a road is blocked?**
Both directions of that undirected edge are skipped. A* recalculates a valid alternative or reports no route.

**Can this system be used for a real emergency?**
No. It is a simulation. Real deployment would require verified street data and road restrictions, authenticated dispatcher/driver roles, consented GPS updates, a shared backend, emergency-service integration, operational validation and much more.

**What is the complexity?**
This implementation scans a Set to find the next node. With the consistent heuristic and the graph used here, worst-case work is O(V² + E) and storage O(V + E), including the graph and trace. A binary heap can improve frontier operations for large graphs.

## Three-minute demonstration

- Open Overview and explain the four metric cards.
- Set a pickup and hospital; point to ambulance → pickup and pickup → hospital routes.
- Enable traffic, then close Central Road, and observe route/time changes.
- Open A* explorer and step through the g, h and f table.
- Create a request and follow the moving vehicle; pause/resume it.
- After hospital arrival, open Trip history and export CSV.
- Open Fleet, take an available unit offline, and show that auto-assignment excludes it.

## Future extensions

Replace the illustrative graph with a validated street graph; add a server and database; integrate consented driver GPS; implement authentication and roles; support simultaneous trips; match units to requested capabilities; support operationally validated traffic and hospital availability. These are future work, not current features.
