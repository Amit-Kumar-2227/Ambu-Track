// Costs are minutes. The straight-line heuristic assumes the fastest legal
// demo speed, so it never overestimates travel time on this road graph.
export const key = (a, b) => [a, b].sort().join('|');
export function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) * 0.012; }
export function edgeCost(a, b, traffic = false) { return distance(a, b) / (b.speed || 50) * 60 * (traffic ? b.traffic || 1 : 1); }
export function aStar(graph, start, goal, { traffic = false, blocked = new Set(), heuristic = true } = {}) {
  if (!graph[start] || !graph[goal]) return { path: [], minutes: Infinity, km: 0, visited: [], steps: [] };
  const h = id => heuristic ? distance(graph[id], graph[goal]) / 50 * 60 : 0;
  const open = new Set([start]), g = new Map([[start, 0]]), parent = new Map(), visited = [], steps = [];
  while (open.size) {
    const current = [...open].reduce((a,b) => g.get(a)+h(a) <= g.get(b)+h(b) ? a : b);
    open.delete(current); visited.push(current);
    steps.push({ node: current, g: g.get(current), h: h(current), f: g.get(current)+h(current), frontier: open.size });
    if (current === goal) {
      const path = [goal]; while (parent.has(path[0])) path.unshift(parent.get(path[0]));
      const km = path.slice(1).reduce((sum, id, i) => sum + distance(graph[path[i]], graph[id]), 0);
      return { path, minutes: g.get(goal), km, visited, steps };
    }
    for (const edge of graph[current].edges) {
      if (blocked.has(key(current, edge.to))) continue;
      const neighbor = graph[edge.to];
      const tentative = g.get(current) + edgeCost(graph[current], { ...neighbor, ...edge }, traffic);
      if (tentative < (g.get(edge.to) ?? Infinity)) {
        parent.set(edge.to, current); g.set(edge.to, tentative); open.add(edge.to);
      }
    }
  }
  return { path: [], minutes: Infinity, km: 0, visited, steps };
}
export function nearestUnit(graph, units, pickup, options) {
  return units.filter(u => u.status === 'Available').map(unit => ({unit, route:aStar(graph, unit.node, pickup, options)})).filter(x=>x.route.path.length).sort((a,b)=>a.route.minutes-b.route.minutes)[0] || null;
}
