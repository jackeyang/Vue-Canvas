import { describe, expect, it, vi } from 'vitest'
import { Polygon } from '@/common/Polygon'
import type { PolygonData } from '@/common/types'

const square: PolygonData = {
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ],
  text: 'Text desc',
}

function createContextStub() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    lineDashOffset: 1,
    lineWidth: 1,
    lineJoin: '',
    lineCap: '',
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  }
}

const drawOptions = {
  lineColor: '#22d3ee',
  fontSize: 14,
  cursor: null,
  width: 300,
  height: 200,
}

describe('Polygon', () => {
  it('从数据重建后是闭合图形，序列化得到独立副本', () => {
    const polygon = Polygon.fromData(square)
    expect(polygon.isClosed).toBe(true)
    expect(polygon.points).toHaveLength(4)
    expect(polygon.text).toBe('Text desc')
    const data = polygon.toData()
    expect(data).toEqual(square)
    data.points[0].x = 999
    expect(polygon.points[0].x).toBe(0)
  })

  it('顶点命中、激活态与平移', () => {
    const polygon = Polygon.fromData(square)
    expect(polygon.findPointIndex({ x: 1, y: 1 }, 8)).toBe(0)
    expect(polygon.findPointIndex({ x: 50, y: 50 }, 8)).toBe(-1)
    polygon.activate()
    polygon.setActivePoint(2)
    expect(polygon.points[2].isActive()).toBe(true)
    polygon.clearActivePoint()
    expect(polygon.points.every((point) => !point.isActive())).toBe(true)
    expect(polygon.isActive).toBe(true)
    polygon.translate(10, 20)
    expect(polygon.points[0]).toMatchObject({ x: 10, y: 20 })
  })

  it('纯几何命中与重叠判定', () => {
    const polygon = Polygon.fromData(square)
    expect(polygon.contains({ x: 50, y: 50 })).toBe(true)
    expect(polygon.contains({ x: 150, y: 50 })).toBe(false)
    const inner = Polygon.fromPoints([
      { x: 40, y: 40 },
      { x: 60, y: 40 },
      { x: 60, y: 60 },
    ])
    inner.close()
    expect(polygon.overlaps(inner)).toBe(true)
  })

  it('闭合校验覆盖点数、自交、越界与重叠', () => {
    const tooFew = Polygon.fromPoints([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
    expect(tooFew.closeValidation([], 300, 200, false)).toContain('至少需要')

    const crossing = Polygon.fromPoints([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 100, y: 0 },
    ])
    expect(crossing.closeValidation([], 300, 200, false)).toContain('交叉')

    const outside = Polygon.fromData(square)
    expect(outside.closeValidation([], 50, 200, false)).toContain('超出')

    const duplicate = Polygon.fromData(square)
    expect(outside.closeValidation([duplicate], 300, 200, false)).toContain('重叠')
    expect(outside.closeValidation([duplicate], 300, 200, true)).toBeNull()
    expect(outside.closeValidation([], 300, 200, false)).toBeNull()
  })

  it('绘制使用标准 lineDashOffset 且文案自适应不越界', () => {
    const polygon = Polygon.fromData(square)
    const ctx = createContextStub()
    polygon.draw(ctx as unknown as CanvasRenderingContext2D, drawOptions)
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
    expect(ctx.lineDashOffset).toBe(0)
    expect('setDashOffset' in ctx).toBe(false)
    expect(ctx.fillText).toHaveBeenCalled()
    expect(ctx.fillRect).toHaveBeenCalled()

    const longText = Polygon.fromData({ ...square, text: '很长的标注文案'.repeat(20) })
    const longCtx = createContextStub()
    longText.draw(longCtx as unknown as CanvasRenderingContext2D, drawOptions)
    expect(longCtx.font).toMatch(/10px/)
    expect(longCtx.fillText.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('受阻预览使用警示色', () => {
    const drawing = Polygon.fromPoints([{ x: 0, y: 0 }])
    const ctx = createContextStub()
    drawing.draw(ctx as unknown as CanvasRenderingContext2D, {
      ...drawOptions,
      cursor: { x: 20, y: 20 },
      blocked: true,
    })
    expect(ctx.strokeStyle).toBe('#ef4444')
  })

  it('绘制中只有一条从最后顶点到光标的跟踪虚线', () => {
    const first = { x: 0, y: 0 }
    const cursor = { x: 120, y: 80 }
    const options = { ...drawOptions, cursor }

    const onePoint = Polygon.fromPoints([first])
    const ctx1 = createContextStub()
    onePoint.draw(ctx1 as unknown as CanvasRenderingContext2D, options)
    expect(ctx1.moveTo).toHaveBeenCalledTimes(2)
    expect(ctx1.lineTo).toHaveBeenCalledTimes(1)
    expect(ctx1.lineTo).toHaveBeenLastCalledWith(cursor.x, cursor.y)

    const twoPoints = Polygon.fromPoints([first, { x: 100, y: 0 }])
    const ctx2 = createContextStub()
    twoPoints.draw(ctx2 as unknown as CanvasRenderingContext2D, options)
    expect(ctx2.moveTo).toHaveBeenCalledTimes(2)
    expect(ctx2.moveTo).toHaveBeenLastCalledWith(100, 0)
    expect(ctx2.lineTo).toHaveBeenCalledTimes(2)
    expect(ctx2.lineTo).toHaveBeenLastCalledWith(cursor.x, cursor.y)
    expect(ctx2.lineTo).not.toHaveBeenCalledWith(first.x, first.y)

    const threePoints = Polygon.fromPoints([first, { x: 100, y: 0 }, { x: 100, y: 100 }])
    const ctx3 = createContextStub()
    threePoints.draw(ctx3 as unknown as CanvasRenderingContext2D, options)
    expect(ctx3.moveTo).toHaveBeenCalledTimes(2)
    expect(ctx3.lineTo).toHaveBeenCalledTimes(3)
    expect(ctx3.lineTo).toHaveBeenLastCalledWith(cursor.x, cursor.y)
    expect(ctx3.lineTo).not.toHaveBeenCalledWith(first.x, first.y)
  })
})
