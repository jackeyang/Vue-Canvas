import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import backImage from '@/assets/back.png'
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MAX_SCALE,
  MIN_FONT_SIZE,
  MIN_SCALE,
} from '@/common/constants'
import { cloneDataset, datasetWithinBounds, parseDatasetJson, scaleDataset } from '@/common/dataset'
import { clamp } from '@/common/geometry'
import type { CursorPosition, Dataset } from '@/common/types'

/** 当前工作区：随画布变更自动写入，用于刷新页面后继续编辑 */
const WORKSPACE_KEY = 'vue-canvas-workspace-v2'
/** 显式保存的快照：只在「保存到本地」时写入，删除图形后仍可恢复 */
const SNAPSHOT_KEY = 'vue-canvas-snapshot-v2'
/** 旧版本使用的单 key，读取时兼容 */
const LEGACY_KEY = 'vue-canvas-dataset-v2'
const BASE_WIDTH = 640
const BASE_HEIGHT = 480

export const useAnnotationStore = defineStore('annotation', () => {
  const markState = ref(false)
  const dataset = ref<Dataset>([])
  const initPolygons = ref<Dataset>([])
  const savedDataset = ref<Dataset>([])
  const scale = ref(1)
  const width = ref(BASE_WIDTH)
  const height = ref(BASE_HEIGHT)
  const fontSize = ref(DEFAULT_FONT_SIZE)
  const lineColor = ref('#22d3ee')
  const description = ref('Text desc')
  const imageSrc = ref(backImage)
  const cursor = ref<CursorPosition | null>(null)
  const notice = ref('')

  const hasPolygons = computed(() => dataset.value.length > 0)
  const hasSnapshot = computed(() => savedDataset.value.length > 0)
  const savedCount = computed(() => savedDataset.value.length)
  const scaleLabel = computed(() => `x${scale.value}`)
  const canZoomIn = computed(() => scale.value < MAX_SCALE)
  const canZoomOut = computed(() => scale.value > MIN_SCALE)

  let noticeTimer: ReturnType<typeof setTimeout> | null = null

  function setNotice(message: string): void {
    notice.value = message
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => {
      notice.value = ''
    }, 4000)
  }

  function setCursor(position: CursorPosition | null): void {
    cursor.value = position
  }

  function toggleMark(): void {
    markState.value = !markState.value
    setNotice(markState.value ? '标注模式已开启' : '标注模式已关闭')
  }

  function persistWorkspace(): void {
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(dataset.value))
    } catch {
      setNotice('本地存储不可用，数据仅保留在内存中')
    }
  }

  function writeSnapshot(data: Dataset): void {
    savedDataset.value = cloneDataset(data)
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(savedDataset.value))
    } catch {
      setNotice('本地存储不可用，快照仅保留在内存中')
    }
  }

  function readSnapshot(): Dataset {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY)
      if (!raw) return []
      const parsed = parseDatasetJson(raw)
      savedDataset.value = parsed
      return parsed
    } catch {
      return []
    }
  }

  /** 组件每次变更只更新工作区，绝不覆盖用户显式保存的快照 */
  function setDataset(next: Dataset): void {
    dataset.value = cloneDataset(next)
    persistWorkspace()
  }

  function saveToLocal(snapshot?: Dataset): void {
    const data = snapshot ?? dataset.value
    writeSnapshot(data)
    persistWorkspace()
    setNotice(`已保存 ${data.length} 个图形到本地`)
  }

  /** 从独立快照恢复；删除、清空画布后依然可用 */
  function recover(): void {
    const snapshot = hasSnapshot.value ? savedDataset.value : readSnapshot()
    if (snapshot.length === 0) {
      setNotice('暂无已保存的图形')
      return
    }
    const next = cloneDataset(snapshot)
    dataset.value = next
    initPolygons.value = cloneDataset(next)
    persistWorkspace()
    setNotice(`已恢复 ${next.length} 个图形`)
  }

  function applyImported(next: Dataset): void {
    const data = cloneDataset(next)
    dataset.value = data
    initPolygons.value = cloneDataset(data)
    writeSnapshot(data)
    persistWorkspace()
    setNotice(`已导入 ${data.length} 个图形`)
  }

  function loadPersisted(): number {
    readSnapshot()
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY) ?? localStorage.getItem(LEGACY_KEY)
      if (!raw) return 0
      const parsed = parseDatasetJson(raw)
      dataset.value = parsed
      initPolygons.value = cloneDataset(parsed)
      if (!hasSnapshot.value && parsed.length > 0) writeSnapshot(parsed)
      return parsed.length
    } catch {
      return 0
    }
  }

  /** 倍率独立管理；坐标深拷贝缩放，字号与画布同倍率变化 */
  function zoom(factor: number): void {
    const nextScale = clamp(scale.value * factor, MIN_SCALE, MAX_SCALE)
    if (nextScale === scale.value) return
    const ratio = nextScale / scale.value
    const nextDataset = scaleDataset(dataset.value, ratio)
    const nextWidth = Math.round(BASE_WIDTH * nextScale)
    const nextHeight = Math.round(BASE_HEIGHT * nextScale)
    if (!datasetWithinBounds(nextDataset, nextWidth, nextHeight)) {
      setNotice('缩放后图形将超出画布，已取消')
      return
    }
    scale.value = nextScale
    width.value = nextWidth
    height.value = nextHeight
    fontSize.value = clamp(Math.round(DEFAULT_FONT_SIZE * nextScale), MIN_FONT_SIZE, MAX_FONT_SIZE)
    dataset.value = nextDataset
    initPolygons.value = cloneDataset(nextDataset)
    persistWorkspace()
    setNotice(`画布缩放至 ${scaleLabel.value}`)
  }

  return {
    markState,
    dataset,
    initPolygons,
    savedDataset,
    scale,
    width,
    height,
    fontSize,
    lineColor,
    description,
    imageSrc,
    cursor,
    notice,
    hasPolygons,
    hasSnapshot,
    savedCount,
    scaleLabel,
    canZoomIn,
    canZoomOut,
    setNotice,
    setCursor,
    toggleMark,
    setDataset,
    saveToLocal,
    recover,
    applyImported,
    loadPersisted,
    zoom,
  }
})
