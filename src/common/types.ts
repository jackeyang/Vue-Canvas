export interface Vec2 {
  x: number
  y: number
}

export interface PointData {
  x: number
  y: number
}

export interface PolygonData {
  points: PointData[]
  text?: string
}

export type Dataset = PolygonData[]

export interface CursorPosition {
  x: number
  y: number
}
