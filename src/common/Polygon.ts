import {
  MIN_FONT_SIZE,
  MIN_POINTS,
  RADIUS,
  PointStatus,
  PolygonStatus,
  resolveColors,
} from './constants'
import {
  boundingBox,
  clamp,
  distance,
  hasSelfIntersection,
  isPointInPolygon,
  isWithinBounds,
  labelPosition,
  polygonsOverlap,
} from './geometry'
import { Point } from './Point'
import type { LineColors } from './constants'
import type { PolygonData, Vec2 } from './types'

export interface DrawOptions {
  lineColor: string
  fontSize: number
  cursor: Vec2 | null
  width: number
  height: number
  blocked?: boolean
}

export class Polygon {
  points: Point[] = []
  text: string
  status: PolygonStatus = PolygonStatus.DRAWING
  isActive = false
  private activePointIndex = -1

  constructor(text = '') {
    this.text = text
  }

  static fromData(data: PolygonData): Polygon {
    const polygon = new Polygon(data.text ?? '')
    polygon.points = data.points.map((point) => Point.from(point))
    polygon.status = PolygonStatus.COMPLETE
    return polygon
  }

  static fromPoints(points: Vec2[], text = ''): Polygon {
    const polygon = new Polygon(text)
    polygon.points = points.map((point) => new Point(point.x, point.y))
    return polygon
  }

  toData(): PolygonData {
    return {
      points: this.points.map((point) => point.toData()),
      text: this.text,
    }
  }

  clone(): Polygon {
    return Polygon.fromData(this.toData())
  }

  get isClosed(): boolean {
    return this.status === PolygonStatus.COMPLETE
  }

  get first(): Point | null {
    return this.points[0] ?? null
  }

  get last(): Point | null {
    return this.points[this.points.length - 1] ?? null
  }

  add(point: Point): void {
    this.points.push(point)
  }

  findPointIndex(point: Vec2, limit: number): number {
    let bestIndex = -1
    let bestDistance = limit
    this.points.forEach((candidate, index) => {
      const current = distance(candidate, point)
      if (current <= bestDistance) {
        bestDistance = current
        bestIndex = index
      }
    })
    return bestIndex
  }

  setActivePoint(index: number): void {
    this.points.forEach((point, current) => point.setActive(current === index))
    this.activePointIndex = index
  }

  clearActive(): void {
    this.isActive = false
    this.activePointIndex = -1
    this.points.forEach((point) => point.setActive(false))
  }

  clearActivePoint(): void {
    this.points.forEach((point) => point.setActive(false))
    this.activePointIndex = -1
  }

  activate(): void {
    this.isActive = true
  }

  contains(point: Vec2): boolean {
    return this.isClosed && isPointInPolygon(point, this.points)
  }

  isSelfIntersecting(): boolean {
    return hasSelfIntersection(this.points)
  }

  overlaps(other: Polygon): boolean {
    return other.isClosed && polygonsOverlap(this.points, other.points)
  }

  isWithinBounds(width: number, height: number): boolean {
    return isWithinBounds(this.points, width, height)
  }

  translate(dx: number, dy: number): void {
    this.points.forEach((point) => {
      point.x += dx
      point.y += dy
    })
  }

  /** 返回阻止闭合的原因；null 表示可以闭合 */
  closeValidation(
    others: Polygon[],
    width: number,
    height: number,
    allowOverlap: boolean,
  ): string | null {
    if (this.points.length < MIN_POINTS) return `至少需要 ${MIN_POINTS} 个顶点`
    if (this.isSelfIntersecting()) return '多边形各边不能交叉'
    if (!this.isWithinBounds(width, height)) return '图形不能超出画布'
    if (!allowOverlap && others.some((other) => other.isClosed && this.overlaps(other))) {
      return '新图形不能与已有图形交叉或重叠'
    }
    return null
  }

  close(): void {
    this.status = PolygonStatus.COMPLETE
    this.clearActive()
  }

  draw(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
    if (this.points.length === 0) return
    const colors = resolveColors(options.lineColor)
    const drawing = !this.isClosed

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = this.isActive ? 2.5 : 2
    ctx.strokeStyle = this.isActive ? colors.active : colors.normal
    ctx.fillStyle = this.isActive ? colors.activeFill : colors.fill
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
    ctx.beginPath()
    this.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    if (!drawing) ctx.closePath()
    if (!drawing) ctx.fill()
    ctx.stroke()

    if (drawing && options.cursor && this.last) {
      ctx.setLineDash([6, 4])
      ctx.lineDashOffset = 0
      ctx.strokeStyle = options.blocked ? '#ef4444' : colors.active
      ctx.beginPath()
      ctx.moveTo(this.last.x, this.last.y)
      ctx.lineTo(options.cursor.x, options.cursor.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    if (this.activePointIndex >= 0 && !drawing) {
      const index = this.activePointIndex
      const count = this.points.length
      const previous = this.points[(index - 1 + count) % count]
      const current = this.points[index]
      const next = this.points[(index + 1) % count]
      ctx.setLineDash([5, 4])
      ctx.lineDashOffset = 0
      ctx.strokeStyle = colors.activePoint
      ctx.beginPath()
      ctx.moveTo(previous.x, previous.y)
      ctx.lineTo(current.x, current.y)
      ctx.lineTo(next.x, next.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    this.points.forEach((point) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = point.status === PointStatus.ACTIVE ? colors.activePoint : colors.point
      ctx.fill()
    })

    if (!drawing && this.text) this.drawLabel(ctx, options, colors)
    ctx.restore()
  }

  private drawLabel(ctx: CanvasRenderingContext2D, options: DrawOptions, colors: LineColors): void {
    const box = boundingBox(this.points)
    const maxWidth = Math.max(48, Math.min(box.width - 12, options.width - 16))
    let fontSize = Math.max(MIN_FONT_SIZE, options.fontSize)
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`
    while (fontSize > MIN_FONT_SIZE && ctx.measureText(this.text).width > maxWidth) {
      fontSize -= 1
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`
    }

    const lines = this.wrapText(ctx, maxWidth, 3)
    if (lines.length === 0) return
    const lineHeight = fontSize * 1.35
    const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width))
    const boxWidth = Math.min(maxWidth, textWidth + 16)
    const boxHeight = lines.length * lineHeight + 10
    const anchor = labelPosition(this.points)
    const left = clamp(anchor.x - boxWidth / 2, 0, Math.max(0, options.width - boxWidth))
    const top = clamp(anchor.y - boxHeight / 2, 0, Math.max(0, options.height - boxHeight))

    ctx.fillStyle = colors.textBackground
    ctx.fillRect(left, top, boxWidth, boxHeight)
    ctx.fillStyle = colors.text
    ctx.textBaseline = 'middle'
    lines.forEach((line, index) => {
      ctx.fillText(line, left + 8, top + 5 + lineHeight * (index + 0.5))
    })
  }

  private wrapText(ctx: CanvasRenderingContext2D, maxWidth: number, maxLines: number): string[] {
    const lines: string[] = []
    let current = ''
    let truncated = false
    const characters = Array.from(this.text)
    for (const character of characters) {
      const candidate = current + character
      if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
        if (lines.length === maxLines - 1) {
          truncated = true
          break
        }
        lines.push(current)
        current = character
      } else {
        current = candidate
      }
    }
    if (current && lines.length < maxLines) lines.push(current)
    if (truncated && lines.length > 0) {
      let last = lines[lines.length - 1]
      while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
        last = last.slice(0, -1)
      }
      lines[lines.length - 1] = last + '…'
    }
    return lines
  }
}
