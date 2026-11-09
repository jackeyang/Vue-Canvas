import { describe, expect, it } from 'vitest'
import {
  boundingBox,
  distance,
  hasSelfIntersection,
  isPointInPolygon,
  isWithinBounds,
  labelPosition,
  onSegment,
  polygonCentroid,
  polygonsOverlap,
  polylineSelfIntersectsOnAppend,
  segmentCrossesPolygon,
  segmentsIntersect,
  translatePoints,
} from '@/common/geometry'

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]

const bowtie = [
  { x: 0, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
  { x: 100, y: 0 },
]

describe('geometry', () => {
  it('计算距离与外接框', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    const box = boundingBox(square)
    expect(box).toMatchObject({ minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 })
    expect(boundingBox([]).width).toBe(0)
  })

  it('线段相交包含共线与共享端点', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true)
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }),
    ).toBe(true)
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBe(false)
    expect(onSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 })).toBe(true)
    expect(onSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 1 })).toBe(false)
  })

  it('射线法判定点是否在多边形内（含边界）', () => {
    expect(isPointInPolygon({ x: 50, y: 50 }, square)).toBe(true)
    expect(isPointInPolygon({ x: 150, y: 50 }, square)).toBe(false)
    expect(isPointInPolygon({ x: 0, y: 50 }, square)).toBe(true)
    expect(isPointInPolygon({ x: 50, y: 50 }, square.slice(0, 2))).toBe(false)
  })

  it('检测自交与多边形重叠', () => {
    expect(hasSelfIntersection(square)).toBe(false)
    expect(hasSelfIntersection(bowtie)).toBe(true)
    const inner = [
      { x: 40, y: 40 },
      { x: 60, y: 40 },
      { x: 60, y: 60 },
    ]
    const outer = [
      { x: 200, y: 200 },
      { x: 260, y: 200 },
      { x: 260, y: 260 },
    ]
    expect(polygonsOverlap(square, inner)).toBe(true)
    expect(polygonsOverlap(square, outer)).toBe(false)
  })

  it('逐点绘制时拦截会交叉的新线段', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    expect(polylineSelfIntersectsOnAppend(points, { x: 50, y: -10 })).toBe(true)
    expect(polylineSelfIntersectsOnAppend(points, { x: 0, y: 100 })).toBe(false)
  })

  it('文案锚点位于多边形内部，且质心与边界检查正确', () => {
    expect(polygonCentroid(square)).toEqual({ x: 50, y: 50 })
    expect(labelPosition(square)).toEqual({ x: 50, y: 50 })
    expect(isWithinBounds(square, 100, 100)).toBe(true)
    expect(isWithinBounds(square, 99, 100)).toBe(false)
  })

  it('平移返回新数组，不修改原点集', () => {
    const original = [{ x: 1, y: 2 }]
    const moved = translatePoints(original, 3, 4)
    expect(moved).toEqual([{ x: 4, y: 6 }])
    expect(original).toEqual([{ x: 1, y: 2 }])
  })

  it('线段与已闭合多边形的交叉检测', () => {
    expect(segmentCrossesPolygon({ x: -50, y: 50 }, { x: 50, y: 50 }, square)).toBe(true)
    expect(segmentCrossesPolygon({ x: -50, y: 50 }, { x: 150, y: 50 }, square)).toBe(true)
    expect(segmentCrossesPolygon({ x: 20, y: 20 }, { x: 40, y: 40 }, square)).toBe(true)
    expect(segmentCrossesPolygon({ x: 150, y: 50 }, { x: 250, y: 50 }, square)).toBe(false)
    expect(segmentCrossesPolygon({ x: -50, y: 50 }, { x: 50, y: 50 }, [])).toBe(false)
  })
})
