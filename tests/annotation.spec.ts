import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAnnotationStore } from '@/stores/annotation'
import type { Dataset } from '@/common/types'

const sample: Dataset = [
  {
    points: [
      { x: 10, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 100 },
    ],
    text: '区域 A',
  },
]

describe('annotation store 保存与恢复', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('保存后删除图形，恢复仍可用且能还原', () => {
    const store = useAnnotationStore()
    store.setDataset(sample)
    expect(store.hasPolygons).toBe(true)

    store.saveToLocal(sample)
    expect(store.hasSnapshot).toBe(true)

    // 模拟「删除选中」后组件抛出的 change
    store.setDataset([])
    expect(store.hasPolygons).toBe(false)
    expect(store.hasSnapshot).toBe(true)

    store.recover()
    expect(store.dataset).toEqual(sample)
    expect(store.initPolygons).toEqual(sample)
    expect(store.initPolygons).not.toBe(store.dataset)
    expect(store.hasPolygons).toBe(true)
  })

  it('工作区后续编辑不会污染已保存的快照', () => {
    const store = useAnnotationStore()
    store.setDataset(sample)
    store.saveToLocal(sample)

    const edited: Dataset = [
      { ...sample[0], points: sample[0].points.map((point) => ({ x: point.x + 5, y: point.y })) },
    ]
    store.setDataset(edited)
    expect(store.savedDataset).toEqual(sample)

    store.recover()
    expect(store.dataset).toEqual(sample)
  })

  it('页面重载后仍可从快照恢复', () => {
    const first = useAnnotationStore()
    first.setDataset(sample)
    first.saveToLocal(sample)
    first.setDataset([])

    setActivePinia(createPinia())
    const second = useAnnotationStore()
    second.loadPersisted()
    expect(second.hasSnapshot).toBe(true)
    second.recover()
    expect(second.dataset).toEqual(sample)
  })

  it('从未保存时恢复给出提示且不产生数据', () => {
    const store = useAnnotationStore()
    expect(store.hasSnapshot).toBe(false)
    store.recover()
    expect(store.dataset).toHaveLength(0)
    expect(store.notice).toContain('暂无')
  })

  it('兼容旧版本单 key 的本地数据', () => {
    localStorage.setItem('vue-canvas-dataset-v2', JSON.stringify(sample))
    const store = useAnnotationStore()
    expect(store.loadPersisted()).toBe(1)
    expect(store.hasSnapshot).toBe(true)

    store.setDataset([])
    store.recover()
    expect(store.dataset).toEqual(sample)
  })
})
