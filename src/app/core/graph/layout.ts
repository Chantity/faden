import type { Edge, Task, TodoList } from '../model';
import { connectedComponents } from './ordering';

/**
 * Deterministisches, top-down Layered-Layout für das Ablaufdiagramm (SPEC 5.4).
 * Reine Funktion: gleiche Eingabe → gleiche Positionen, kein freies Verschieben.
 */

export interface LayoutOptions {
  nodeWidth?: number;
  /** Grundhöhe für einen einzeiligen Titel. */
  nodeHeight?: number;
  /** Zusätzliche Höhe je weiterer Titelzeile. */
  nodeLineHeight?: number;
  nodeMaxLines?: number;
  /** Ungefähre Zeichen pro Zeile (bestimmt den Umbruch im Layout). */
  nodeCharsPerLine?: number;
  hGap?: number;
  vGap?: number;
  componentGap?: number;
  padding?: number;
}

export interface LayoutNode {
  id: string;
  /** Linke obere Ecke der Karte. */
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
  /** Geschätzte Titelzeilen (1–nodeMaxLines); steuert die Höhe. */
  lines: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  path: string;
  /** Mittelpunkt der Kante (für das „+"). */
  midX: number;
  midY: number;
}

export interface Layout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
}

const DEFAULTS: Required<LayoutOptions> = {
  nodeWidth: 200,
  nodeHeight: 76,
  nodeLineHeight: 24,
  nodeMaxLines: 3,
  nodeCharsPerLine: 20,
  hGap: 28,
  vGap: 56,
  componentGap: 72,
  padding: 32,
};

/**
 * Schätzt die Anzahl der Titelzeilen aus der Zeichenzahl. Bewusst konservativ
 * (wenige Zeichen pro Zeile) und nach oben begrenzt – der Titel wird im Diagramm
 * ohnehin per `line-clamp` auf dieselbe Zeilenzahl begrenzt, Temperaturschwankung
 * zwischen Schätzung und Rendering gibt es damit nicht.
 */
function estimateLines(title: string, opts: Required<LayoutOptions>): number {
  const length = title.trim().length;
  if (length === 0) return 1;
  const lines = Math.ceil(length / opts.nodeCharsPerLine);
  return Math.min(opts.nodeMaxLines, Math.max(1, lines));
}

function estimateNodeHeight(lines: number, opts: Required<LayoutOptions>): number {
  return opts.nodeHeight + (lines - 1) * opts.nodeLineHeight;
}

export function layoutList(list: TodoList, options: LayoutOptions = {}): Layout {
  const opts = { ...DEFAULTS, ...options };
  const components = connectedComponents(list);

  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let xOffset = opts.padding;
  let maxBottom = opts.padding;

  for (const component of components) {
    const placed = layoutComponent(component.tasks, component.edges, opts, xOffset);
    nodes.push(...placed.nodes);
    edges.push(...placed.edges);
    xOffset += placed.width + opts.componentGap;
    maxBottom = Math.max(maxBottom, placed.height);
  }

  const width = nodes.length === 0 ? opts.padding : xOffset - opts.componentGap + opts.padding;
  return {
    nodes,
    edges,
    width,
    height: maxBottom,
    nodeWidth: opts.nodeWidth,
    nodeHeight: opts.nodeHeight,
  };
}

function layoutComponent(
  tasks: Task[],
  edges: Edge[],
  opts: Required<LayoutOptions>,
  xOffset: number,
): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  if (tasks.length === 0) {
    return { nodes: [], edges: [], width: 0, height: opts.padding };
  }

  const index = new Map<string, number>(tasks.map((t, i) => [t.id, i]));
  const preds = new Map<string, string[]>(tasks.map((t) => [t.id, []]));
  const succs = new Map<string, string[]>(tasks.map((t) => [t.id, []]));
  for (const e of edges) {
    if (!index.has(e.from) || !index.has(e.to)) continue;
    (preds.get(e.to) as string[]).push(e.from);
    (succs.get(e.from) as string[]).push(e.to);
  }

  // Schichtzuweisung: längster Pfad von den Wurzeln (stabil, deterministisch).
  const layer = new Map<string, number>(tasks.map((t) => [t.id, 0]));
  const order = topoOrder(tasks, index, succs, preds);
  for (const id of order) {
    for (const s of succs.get(id) ?? []) {
      layer.set(s, Math.max(layer.get(s) ?? 0, (layer.get(id) ?? 0) + 1));
    }
  }

  // Knoten je Schicht sammeln und nach Barycenter der Vorgänger ordnen.
  const byLayer = new Map<number, string[]>();
  for (const id of order) {
    const l = layer.get(id) ?? 0;
    const bucket = byLayer.get(l);
    if (bucket) bucket.push(id);
    else byLayer.set(l, [id]);
  }
  const positionInLayer = new Map<string, number>();
  for (const l of [...byLayer.keys()].sort((a, b) => a - b)) {
    const ids = (byLayer.get(l) as string[]).slice();
    if (l > 0) {
      const key = (id: string): number => {
        const ps = preds.get(id) ?? [];
        if (ps.length === 0) return index.get(id) ?? 0;
        let sum = 0;
        for (const p of ps) sum += positionInLayer.get(p) ?? 0;
        return sum / ps.length;
      };
      ids.sort((a, b) => key(a) - key(b));
    }
    ids.forEach((id, i) => positionInLayer.set(id, i));
  }

  const nodeMap = new Map<string, LayoutNode>();
  const nodes: LayoutNode[] = [];
  const xStep = opts.nodeWidth + opts.hGap;
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const linesOf = (id: string): number => estimateLines(taskById.get(id)?.title ?? '', opts);
  const heightOf = (id: string): number => estimateNodeHeight(linesOf(id), opts);

  // Schichtweise von oben nach unten: jede Schicht beginnt unter der höchsten
  // Karte der vorigen Schicht, damit auch mehrzeilige Karten Platz bekommen.
  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  const layerY = new Map<number, number>();
  let cursor = opts.padding;
  for (const l of sortedLayers) {
    layerY.set(l, cursor);
    const maxHeight = Math.max(...(byLayer.get(l) as string[]).map(heightOf));
    cursor += maxHeight + opts.vGap;
  }

  let maxOrder = 0;
  for (const l of sortedLayers) {
    for (const id of byLayer.get(l) as string[]) {
      const order = positionInLayer.get(id) ?? 0;
      maxOrder = Math.max(maxOrder, order);
      const lines = linesOf(id);
      const node: LayoutNode = {
        id,
        x: xOffset + order * xStep,
        y: layerY.get(l) ?? opts.padding,
        width: opts.nodeWidth,
        height: estimateNodeHeight(lines, opts),
        layer: l,
        lines,
      };
      nodes.push(node);
      nodeMap.set(id, node);
    }
  }

  const layoutEdges: LayoutEdge[] = [];
  for (const e of edges) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (!from || !to) continue;
    layoutEdges.push(edgeGeometry(e, from, to));
  }

  const width = (maxOrder + 1) * xStep - opts.hGap;
  // `cursor` zeigt bereits hinter die letzte Schicht (inkl. vGap).
  const height = cursor - opts.vGap + opts.padding;

  return { nodes, edges: layoutEdges, width, height };
}

/**
 * Gerade Linie von der Unterkante der Quellkarte zur Oberkante der Zielkarte.
 * Bewusst keine rechtwinklige Führung: Bei Verzweigungen würden sich die
 * senkrechten Teilstücke sonst überlagern/Kreuzen.
 */
function edgeGeometry(edge: Edge, from: LayoutNode, to: LayoutNode): LayoutEdge {
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height;
  const tx = to.x + to.width / 2;
  const ty = to.y;
  const path = `M ${fx} ${fy} L ${tx} ${ty}`;
  return { id: edge.id, from: edge.from, to: edge.to, path, midX: (fx + tx) / 2, midY: (fy + ty) / 2 };
}

/** Stabile topologische Ordnung (Erstellungsreihenfolge bei Gleichstand). */
function topoOrder(
  tasks: Task[],
  index: Map<string, number>,
  succs: Map<string, string[]>,
  preds: Map<string, string[]>,
): string[] {
  const indegree = new Map<string, number>(tasks.map((t) => [t.id, (preds.get(t.id) ?? []).length]));
  const remaining = new Set(tasks.map((t) => t.id));
  const result: string[] = [];

  while (remaining.size > 0) {
    let pick: string | null = null;
    let pickIndex = Number.POSITIVE_INFINITY;
    for (const id of remaining) {
      if ((indegree.get(id) ?? 0) !== 0) continue;
      const i = index.get(id) ?? Number.POSITIVE_INFINITY;
      if (i < pickIndex) {
        pickIndex = i;
        pick = id;
      }
    }
    if (pick === null) {
      // Zyklus: Rest stabil anhängen (darf laut Invarianten nicht passieren).
      for (const id of [...remaining].sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0))) {
        result.push(id);
      }
      break;
    }
    remaining.delete(pick);
    result.push(pick);
    for (const s of succs.get(pick) ?? []) {
      indegree.set(s, (indegree.get(s) ?? 0) - 1);
    }
  }
  return result;
}
