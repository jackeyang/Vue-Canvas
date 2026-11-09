import { describe, expect, it } from 'vitest'
import {
  DatasetFormatError,
  cloneDataset,
  datasetToPolygons,
  datasetWithinBounds,
  isPointData,
  isPolygonData,
  parseDataset,
  parseDatasetJson,
  scaleDataset,
  serializeDataset,
} from '@/common/dataset'
import { Polygon } from '@/common/Polygon'
import type { Dataset } from '@/common/types'

const sample: Dataset = [
  {
    points: [
      { x: 10, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 100 },
    ],
    text: 'Text desc',
  },
]

describe('dataset 校验与序列化', () => {
  it('合法数据被解析为独立副本', () => {
    const parsed = parseDataset(sample)
    expect(parsed).toEqual(sample)
    expect(parsed).not.toBe(sample)
    parsed[0].points[0].x = 999
    expect(sample[0].points[0].x).toBe(10)
  })

  it('拒绝非法结构与非有限数值', () => {
    const invalid: unknown[] = [
      null,
      {},
      [{ points: [] }],
      [{ points: [{ x: 1, y: 2 }] }],
      [
        {
          points: [
            { x: NaN, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 2 },
          ],
        },
      ],
      [
        {
          points: [
            { x: Infinity, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 2 },
          ],
        },
      ],
      [
        {
          points: [
            { x: '1', y: 2 },
            { x: 1, y: 1 },
            { x: 1, y: 2 },
          ],
        },
      ],
      [{ points: [{ x: 1, y: 2 }, null, { x: 1, y: 2 }] }],
      [{ points: sample[0].points, text: 42 }],
    ]
    for (const value of invalid) {
      expect(() => parseDataset(value)).toThrow(DatasetFormatError)
    }
    expect(() => parseDatasetJson('{ not json')).toThrow(DatasetFormatError)
  })

  it('类型守卫不依赖对象自身的 hasOwnProperty', () => {
    const bare = Object.create(null) as Record<string, unknown>
    bare.x = 1
    bare.y = 2
    expect(isPointData(bare)).toBe(true)
    expect(isPointData({ x: 1, y: 2, hasOwnProperty: true })).toBe(true)
    expect(isPolygonData({ points: sample[0].points })).toBe(true)
    expect(isPolygonData({ points: sample[0].points, text: 'ok' })).toBe(true)
  })

  it('深拷贝与缩放都是纯函数', () => {
    const cloned = cloneDataset(sample)
    cloned[0].points[1].y = 777
    expect(sample[0].points[1].y).toBe(10)

    const scaled = scaleDataset(sample, 2)
    expect(scaled[0].points[0]).toEqual({ x: 20, y: 20 })
    expect(sample[0].points[0]).toEqual({ x: 10, y: 10 })
    expect(() => scaleDataset(sample, 0)).toThrow(DatasetFormatError)
    expect(() => scaleDataset(sample, -1)).toThrow(DatasetFormatError)
    expect(() => scaleDataset(sample, Number.NaN)).toThrow(DatasetFormatError)
  })

  it('边界检查、序列化只导出已闭合图形', () => {
    expect(datasetWithinBounds(sample, 200, 200)).toBe(true)
    expect(datasetWithinBounds(sample, 50, 200)).toBe(false)

    const complete = Polygon.fromData(sample[0])
    const drawing = Polygon.fromPoints([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
    expect(serializeDataset([complete, drawing])).toEqual(sample)
    expect(datasetToPolygons(sample).every((polygon) => polygon.isClosed)).toBe(true)
  })
})
