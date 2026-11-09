import { PointStatus } from './constants'
import { distance } from './geometry'
import type { PointData, Vec2 } from './types'

export class Point implements Vec2 {
  x: number
  y: number
  status: PointStatus

  constructor(x: number, y: number, status: PointStatus = PointStatus.NORMAL) {
    this.x = x
    this.y = y
    this.status = status
  }

  static from(data: PointData): Point {
    return new Point(data.x, data.y)
  }

  toData(): PointData {
    return { x: this.x, y: this.y }
  }

  clone(): Point {
    return new Point(this.x, this.y, this.status)
  }

  distanceTo(other: Vec2): number {
    return distance(this, other)
  }

  isActive(): boolean {
    return this.status === PointStatus.ACTIVE
  }

  setActive(active: boolean): void {
    this.status = active ? PointStatus.ACTIVE : PointStatus.NORMAL
  }
}
