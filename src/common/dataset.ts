import { MIN_POINTS } from './constants'
import { isWithinBounds } from './geometry'
import { Polygon } from './Polygon'
import type { Dataset, PointData, PolygonData } from './types'

export class DatasetFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatasetFormatError'
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 使用类型守卫校验外部数据，避免直接调用 hasOwnProperty 与脏数据导致的运行时异常 */
export function isPointData(value: unknown): value is PointData {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isFiniteNumber(record.x) && isFiniteNumber(record.y)
}

export function isPolygonData(value: unknown): value is PolygonData {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.points)) return false
  const points: unknown[] = record.points
  if (points.length < MIN_POINTS || !points.every(isPointData)) return false
  return record.text === undefined || typeof record.text === 'string'
}

export function parseDataset(input: unknown): Dataset {
  if (!Array.isArray(input)) throw new DatasetFormatError('标注数据必须是数组')
  const items: unknown[] = input
  return items.map((item, index) => {
    if (!isPolygonData(item)) {
      throw new DatasetFormatError(`第 ${index + 1} 个图形格式不合法`)
    }
    return {
      points: item.points.map((point) => ({ x: point.x, y: point.y })),
      text: item.text ?? '',
    }
  })
}

export function parseDatasetJson(text: string): Dataset {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new DatasetFormatError('文件不是合法的 JSON')
  }
  return parseDataset(parsed)
}

export function serializeDataset(polygons: Polygon[]): Dataset {
  return polygons.filter((polygon) => polygon.isClosed).map((polygon) => polygon.toData())
}

export function cloneDataset(data: Dataset): Dataset {
  return data.map((item) => ({
    points: item.points.map((point) => ({ x: point.x, y: point.y })),
    text: item.text,
  }))
}

/** 纯函数：返回全新的坐标数组，绝不原地修改传入数据 */
export function scaleDataset(data: Dataset, factor: number): Dataset {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new DatasetFormatError('缩放倍率必须是正数')
  }
  return data.map((item) => ({
    points: item.points.map((point) => ({ x: point.x * factor, y: point.y * factor })),
    text: item.text,
  }))
}

export function datasetWithinBounds(data: Dataset, width: number, height: number): boolean {
  return data.every((item) => isWithinBounds(item.points, width, height))
}

export function datasetToPolygons(data: Dataset): Polygon[] {
  return data.map((item) => Polygon.fromData(item))
}
