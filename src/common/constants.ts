export const RADIUS = 4
export const CLOSE_LIMIT = 25
export const ACTIVE_LIMIT = 8
export const MIN_FONT_SIZE = 10
export const MAX_FONT_SIZE = 36
export const DEFAULT_FONT_SIZE = 14
export const MIN_POINTS = 3
export const MIN_SCALE = 0.5
export const MAX_SCALE = 2

export const PointStatus = {
  NORMAL: 'NORMAL',
  ACTIVE: 'ACTIVE',
} as const
export type PointStatus = (typeof PointStatus)[keyof typeof PointStatus]

export const PolygonStatus = {
  DRAWING: 'DRAWING',
  COMPLETE: 'COMPLETE',
} as const
export type PolygonStatus = (typeof PolygonStatus)[keyof typeof PolygonStatus]

export interface LineColors {
  normal: string
  active: string
  point: string
  activePoint: string
  text: string
  textBackground: string
  fill: string
  activeFill: string
}

export function resolveColors(lineColor: string): LineColors {
  return {
    normal: lineColor || '#22d3ee',
    active: '#ffffff',
    point: '#fbbf24',
    activePoint: '#ef4444',
    text: '#ffffff',
    textBackground: 'rgba(15, 23, 42, 0.78)',
    fill: 'rgba(34, 211, 238, 0.12)',
    activeFill: 'rgba(255, 255, 255, 0.16)',
  }
}
