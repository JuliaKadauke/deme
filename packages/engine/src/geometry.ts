import type { HotspotArea, PolygonPoints } from "@deme/content-schema";

export interface Point {
  x: number;
  y: number;
}

export function pointInRect(
  point: Point,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** Ray-casting point-in-polygon test. `points` need not be closed (first point repeated). */
export function pointInPolygon(point: Point, points: PolygonPoints): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i]!;
    const pj = points[j]!;
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    const intersects =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function hitTestArea(area: HotspotArea, point: Point): boolean {
  return area.shape === "rect" ? pointInRect(point, area) : pointInPolygon(point, area.points);
}

function nearestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSquared));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Returns `point` unchanged if it already falls inside the polygon, otherwise
 * the nearest point on the polygon's boundary. Used to clamp click-to-walk
 * targets into a room's walk box.
 */
export function clampToPolygon(point: Point, points: PolygonPoints): Point {
  if (pointInPolygon(point, points)) return point;

  let best: Point | undefined;
  let bestDistance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const candidate = nearestPointOnSegment(point, { x: a[0], y: a[1] }, { x: b[0], y: b[1] });
    const distance = distanceSquared(point, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best ?? point;
}
