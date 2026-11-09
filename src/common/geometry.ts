import type { Vec2 } from './types'

const EPSILON = 1e-9

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function boundingBox(points: Vec2[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

function cross(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

export function onSegment(a: Vec2, b: Vec2, point: Vec2): boolean {
  if (Math.abs(cross(a, b, point)) > EPSILON) return false
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  )
}

export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(a, b, c)
  const d2 = cross(a, b, d)
  const d3 = cross(c, d, a)
  const d4 = cross(c, d, b)
  const straddles =
    ((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
    ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))
  if (straddles) return true
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)
}

/** 纯几何的射线法命中检测，不再依赖 isPointInPath 与重绘副作用 */
export function isPointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  if (polygon.length < 3) return false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (onSegment(polygon[j], polygon[i], point)) return true
  }
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]
    const b = polygon[i]
    const crossesRay =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    if (crossesRay) inside = !inside
  }
  return inside
}

/** 闭合多边形的非相邻边相交即为自交 */
export function hasSelfIntersection(points: Vec2[]): boolean {
  const count = points.length
  if (count < 4) return false
  for (let i = 0; i < count; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % count]
    for (let j = i + 1; j < count; j += 1) {
      if (j === i + 1 || (i === 0 && j === count - 1)) continue
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % count])) return true
    }
  }
  return false
}

export function polygonsOverlap(first: Vec2[], second: Vec2[]): boolean {
  if (first.length < 3 || second.length < 3) return false
  for (let i = 0; i < first.length; i += 1) {
    const a = first[i]
    const b = first[(i + 1) % first.length]
    for (let j = 0; j < second.length; j += 1) {
      const c = second[j]
      const d = second[(j + 1) % second.length]
      if (segmentsIntersect(a, b, c, d)) return true
    }
  }
  return (
    first.some((point) => isPointInPolygon(point, second)) ||
    second.some((point) => isPointInPolygon(point, first))
  )
}

export function polygonCentroid(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 }
  let twiceArea = 0
  let x = 0
  let y = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const factor = a.x * b.y - b.x * a.y
    twiceArea += factor
    x += (a.x + b.x) * factor
    y += (a.y + b.y) * factor
  }
  if (Math.abs(twiceArea) < EPSILON) {
    return averagePoint(points)
  }
  return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) }
}

export function averagePoint(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 }
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), {
    x: 0,
    y: 0,
  })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

/** 文案锚点优先取多边形内部的面积质心，退化时回退到外接框中心 */
export function labelPosition(points: Vec2[]): Vec2 {
  const centroid = polygonCentroid(points)
  if (isPointInPolygon(centroid, points)) return centroid
  const box = boundingBox(points)
  const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }
  if (isPointInPolygon(center, points)) return center
  return centroid
}

export function isWithinBounds(points: Vec2[], width: number, height: number): boolean {
  return points.every(
    (point) => point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height,
  )
}

export function translatePoints(points: Vec2[], dx: number, dy: number): Vec2[] {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }))
}

/** 向未闭合折线追加一点时，检查新线段是否与已有非相邻边相交 */
export function polylineSelfIntersectsOnAppend(points: Vec2[], next: Vec2): boolean {
  const count = points.length
  if (count < 3) return false
  const last = points[count - 1]
  for (let i = 0; i < count - 2; i += 1) {
    if (segmentsIntersect(last, next, points[i], points[i + 1])) return true
  }
  return false
}

/** 线段是否与闭合多边形交叉（含终点落入其内部） */
export function segmentCrossesPolygon(from: Vec2, to: Vec2, polygon: Vec2[]): boolean {
  if (polygon.length < 3) return false
  for (let i = 0; i < polygon.length; i += 1) {
    if (segmentsIntersect(from, to, polygon[i], polygon[(i + 1) % polygon.length])) return true
  }
  return isPointInPolygon(to, polygon)
}
