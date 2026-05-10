export interface Node {
  id: number;
  x: number;
  y: number;
  flow: number;
}

export interface Edge {
  i: number;
  j: number;
  length: number;
  D: number;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  adj: number[][];
}

function initialD(): number {
  return 0.5 + 0.1 * (Math.random() - 0.5);
}

export function emptyGraph(): Graph {
  return { nodes: [], edges: [], adj: [] };
}

export function buildCompleteGraph(nodes: Node[]): Graph {
  const graph: Graph = { nodes: [...nodes], edges: [], adj: [] };
  for (let k = 0; k < nodes.length; k++) graph.adj.push([]);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const length = Math.hypot(dx, dy);
      const edgeIndex = graph.edges.length;
      graph.edges.push({ i, j, length, D: initialD() });
      graph.adj[i].push(edgeIndex);
      graph.adj[j].push(edgeIndex);
    }
  }
  return graph;
}

export function addNode(graph: Graph, x: number, y: number, flow: number): Node {
  const id = graph.nodes.length;
  const node: Node = { id, x, y, flow };
  graph.nodes.push(node);
  graph.adj.push([]);
  for (let k = 0; k < id; k++) {
    const dx = graph.nodes[k].x - x;
    const dy = graph.nodes[k].y - y;
    const length = Math.hypot(dx, dy);
    const edgeIndex = graph.edges.length;
    graph.edges.push({ i: k, j: id, length, D: initialD() });
    graph.adj[k].push(edgeIndex);
    graph.adj[id].push(edgeIndex);
  }
  return node;
}

export function hasSourceAndSink(graph: Graph): boolean {
  let src = false;
  let snk = false;
  for (const n of graph.nodes) {
    if (n.flow > 0) src = true;
    else if (n.flow < 0) snk = true;
    if (src && snk) return true;
  }
  return false;
}
