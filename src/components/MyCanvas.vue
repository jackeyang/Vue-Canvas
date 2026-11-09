<template>
  <div
    class="canvas-host"
    :class="{ 'is-marking': markState }"
    :style="{ width: `${width}px`, height: `${height}px` }"
    @contextmenu.prevent="cancelDrawing"
  >
    <canvas
      ref="backgroundCanvas"
      class="canvas-layer canvas-background"
      aria-hidden="true"
    ></canvas>
    <canvas
      ref="markCanvas"
      class="canvas-layer canvas-mark"
      :aria-label="ariaLabel"
      :aria-describedby="helpId"
      role="application"
      tabindex="0"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
      @keydown="onKeyDown"
    >
      您的浏览器不支持 Canvas，请使用支持 HTML5 Canvas 的浏览器。
    </canvas>
    <p :id="helpId" class="sr-only">
      使用鼠标或触摸逐点绘制多边形，靠近起点点击可自动闭合；按 Enter 闭合，Escape 取消绘制， Delete
      删除选中图形，方向键移动选中图形。
    </p>
    <p class="sr-only" role="status" aria-live="polite">{{ statusText }}</p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { ACTIVE_LIMIT, CLOSE_LIMIT, DEFAULT_FONT_SIZE, MIN_POINTS } from '@/common/constants'
import { datasetToPolygons, serializeDataset } from '@/common/dataset'
import {
  boundingBox,
  clamp,
  distance,
  isPointInPolygon,
  isWithinBounds,
  polylineSelfIntersectsOnAppend,
  polygonsOverlap,
  segmentCrossesPolygon,
  translatePoints,
} from '@/common/geometry'
import { Point } from '@/common/Point'
import { Polygon } from '@/common/Polygon'
import type { CursorPosition, Dataset, Vec2 } from '@/common/types'

interface Props {
  width: number
  height: number
  markState: boolean
  imageSrc?: string
  lineColor?: string
  fontSize?: number
  initPolygons?: Dataset
  description?: string
  emitCursorPosition?: boolean
  allowOverlap?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  imageSrc: '',
  lineColor: '#22d3ee',
  fontSize: DEFAULT_FONT_SIZE,
  initPolygons: (): Dataset => [],
  description: '',
  emitCursorPosition: false,
  allowOverlap: false,
  ariaLabel: '多边形标注画布',
})

const emit = defineEmits<{
  change: [dataset: Dataset]
  markClosed: [dataset: Dataset]
  cursorPosition: [position: CursorPosition | null]
  notice: [message: string]
}>()

const backgroundCanvas = ref<HTMLCanvasElement | null>(null)
const markCanvas = ref<HTMLCanvasElement | null>(null)
const statusText = ref('')
const helpId = `canvas-help-${useId()}`

let backContext: CanvasRenderingContext2D | null = null
let markContext: CanvasRenderingContext2D | null = null
let imageElement: HTMLImageElement | null = null
let polygons: Polygon[] = []
let activePolygon: Polygon | null = null
let dragMode: 'none' | 'point' | 'polygon' = 'none'
let pointerId: number | null = null
let lastPointer: Vec2 | null = null
let cursor: Vec2 | null = null
let frameHandle = 0
let lastNoticeTime = 0
let lastNotice = ''

function scheduleFrame(callback: () => void): number {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : window.setTimeout(callback, 16)
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  else window.clearTimeout(handle)
}

function emitNotice(message: string): void {
  const now = Date.now()
  if (message === lastNotice && now - lastNoticeTime < 800) return
  lastNotice = message
  lastNoticeTime = now
  statusText.value = message
  emit('notice', message)
}

function emitCursor(): void {
  if (!props.emitCursorPosition) return
  emit('cursorPosition', cursor ? { x: Math.round(cursor.x), y: Math.round(cursor.y) } : null)
}

function scheduleDraw(): void {
  if (frameHandle) return
  frameHandle = scheduleFrame(() => {
    frameHandle = 0
    drawMarks()
    emitCursor()
  })
}

/** 用组件内 ref 获取画布，杜绝固定 id 查询，使组件可多实例共存 */
function setupCanvas(): void {
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3)
  const pixelWidth = Math.max(1, Math.round(props.width * ratio))
  const pixelHeight = Math.max(1, Math.round(props.height * ratio))
  const layers: Array<[HTMLCanvasElement | null, 'back' | 'mark']> = [
    [backgroundCanvas.value, 'back'],
    [markCanvas.value, 'mark'],
  ]
  for (const [canvas, kind] of layers) {
    if (!canvas) continue
    canvas.width = pixelWidth
    canvas.height = pixelHeight
    const context = canvas.getContext('2d')
    if (!context) {
      emitNotice('当前环境不支持 2D Canvas 上下文')
      continue
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    if (kind === 'back') backContext = context
    else markContext = context
  }
}

/** 底图层只在图片或尺寸变化时重绘，不随鼠标移动重复 drawImage */
function drawBackground(): void {
  if (!backContext) return
  backContext.clearRect(0, 0, props.width, props.height)
  backContext.fillStyle = '#e8edf7'
  backContext.fillRect(0, 0, props.width, props.height)
  if (imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
    backContext.drawImage(imageElement, 0, 0, props.width, props.height)
  } else {
    backContext.fillStyle = '#94a3b8'
    backContext.font = '14px system-ui, sans-serif'
    backContext.textAlign = 'center'
    backContext.fillText('底图未加载', props.width / 2, props.height / 2)
    backContext.textAlign = 'start'
  }
}

/** 绘制阶段实时判断新线段是否与已闭合图形交叉 */
function crossesExistingPolygons(from: Vec2, to: Vec2): boolean {
  if (props.allowOverlap) return false
  return polygons.some((other) => other.isClosed && segmentCrossesPolygon(from, to, other.points))
}

function isBlockedPreview(drawing: Polygon | null, next: Vec2): boolean {
  if (!drawing) return false
  const last = drawing.last
  if (!last) return false
  return crossesExistingPolygons(last, next) || polylineSelfIntersectsOnAppend(drawing.points, next)
}

function drawMarks(): void {
  if (!markContext) return
  markContext.clearRect(0, 0, props.width, props.height)
  const drawing = getDrawingPolygon()
  const blocked = Boolean(drawing && cursor && isBlockedPreview(drawing, cursor))
  for (const polygon of polygons) {
    polygon.draw(markContext, {
      lineColor: props.lineColor,
      fontSize: props.fontSize,
      cursor,
      width: props.width,
      height: props.height,
      blocked: polygon === drawing && blocked,
    })
  }
}

function loadImage(): void {
  if (imageElement) {
    imageElement.onload = null
    imageElement.onerror = null
  }
  imageElement = null
  if (!props.imageSrc) {
    drawBackground()
    return
  }
  const next = new Image()
  next.onload = () => {
    imageElement = next
    drawBackground()
  }
  next.onerror = () => {
    emitNotice('底图加载失败')
    drawBackground()
  }
  next.src = props.imageSrc
}

function getPosition(event: PointerEvent): Vec2 {
  const canvas = markCanvas.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width > 0 ? props.width / rect.width : 1
  const scaleY = rect.height > 0 ? props.height / rect.height : 1
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

function clampPoint(point: Vec2): Vec2 {
  return {
    x: clamp(point.x, 0, props.width),
    y: clamp(point.y, 0, props.height),
  }
}

function getDrawingPolygon(): Polygon | null {
  return polygons.find((polygon) => !polygon.isClosed) ?? null
}

function getActivePolygon(): Polygon | null {
  return polygons.find((polygon) => polygon.isActive && polygon.isClosed) ?? null
}

function activatePolygon(polygon: Polygon): void {
  polygons.forEach((item) => item.clearActive())
  polygon.activate()
  activePolygon = polygon
}

function clearActivation(): void {
  polygons.forEach((polygon) => polygon.clearActive())
  activePolygon = null
}

function toDataset(): Dataset {
  return serializeDataset(polygons)
}

function discardDrawing(): void {
  const drawing = getDrawingPolygon()
  if (!drawing) return
  polygons = polygons.filter((polygon) => polygon !== drawing)
  cursor = null
  emit('change', toDataset())
  scheduleDraw()
}

function cancelDrawing(): void {
  if (!getDrawingPolygon()) return
  discardDrawing()
  statusText.value = '已取消当前绘制'
}

function finishDrawing(polygon: Polygon): boolean {
  const first = polygon.first
  const last = polygon.last
  if (first && last && crossesExistingPolygons(last, first)) {
    emitNotice('闭合边不能与已有图形交叉或重叠')
    return false
  }
  const reason = polygon.closeValidation(
    polygons.filter((item) => item !== polygon),
    props.width,
    props.height,
    props.allowOverlap,
  )
  if (reason) {
    emitNotice(reason)
    return false
  }
  polygon.close()
  statusText.value = `图形已闭合，当前共 ${polygons.filter((item) => item.isClosed).length} 个图形`
  emit('markClosed', toDataset())
  emit('change', toDataset())
  scheduleDraw()
  return true
}

function deleteActive(): boolean {
  const target = activePolygon ?? [...polygons].reverse().find((polygon) => polygon.isClosed)
  if (!target) {
    emitNotice('没有可删除的图形')
    return false
  }
  polygons = polygons.filter((polygon) => polygon !== target)
  activePolygon = null
  dragMode = 'none'
  statusText.value = '已删除图形'
  emit('change', toDataset())
  scheduleDraw()
  return true
}

function clearAll(): void {
  polygons = []
  activePolygon = null
  dragMode = 'none'
  cursor = null
  statusText.value = '画布已清空'
  emit('change', toDataset())
  scheduleDraw()
}

function focusCanvas(): void {
  markCanvas.value?.focus()
}

function canTranslate(polygon: Polygon, dx: number, dy: number): boolean {
  const next = translatePoints(polygon.points, dx, dy)
  if (!isWithinBounds(next, props.width, props.height)) return false
  return (
    props.allowOverlap ||
    !polygons.some(
      (other) => other !== polygon && other.isClosed && polygonsOverlap(next, other.points),
    )
  )
}

/** 键盘单步平移：整体生效或整体放弃 */
function tryTranslate(polygon: Polygon, dx: number, dy: number): boolean {
  if (!canTranslate(polygon, dx, dy)) return false
  polygon.translate(dx, dy)
  return true
}

/** 指针拖动：把位移裁剪到画布内，受阻时按轴滑移，贴边后仍可沿边界移动 */
function slideTranslate(polygon: Polygon, dx: number, dy: number): void {
  const box = boundingBox(polygon.points)
  const lowerX = -box.minX
  const upperX = props.width - box.maxX
  const lowerY = -box.minY
  const upperY = props.height - box.maxY
  const limitedDx = lowerX <= upperX ? clamp(dx, lowerX, upperX) : 0
  const limitedDy = lowerY <= upperY ? clamp(dy, lowerY, upperY) : 0
  if (limitedDx === 0 && limitedDy === 0) return
  if (canTranslate(polygon, limitedDx, limitedDy)) {
    polygon.translate(limitedDx, limitedDy)
    return
  }
  if (limitedDx !== 0 && canTranslate(polygon, limitedDx, 0)) {
    polygon.translate(limitedDx, 0)
  }
  if (limitedDy !== 0 && canTranslate(polygon, 0, limitedDy)) {
    polygon.translate(0, limitedDy)
  }
}

function tryMovePoint(polygon: Polygon, index: number, next: Vec2): boolean {
  const point = polygon.points[index]
  if (!point) return false
  const previous = { x: point.x, y: point.y }
  point.x = next.x
  point.y = next.y
  const valid =
    !polygon.isSelfIntersecting() &&
    polygon.isWithinBounds(props.width, props.height) &&
    (props.allowOverlap ||
      !polygons.some((other) => other !== polygon && other.isClosed && polygon.overlaps(other)))
  if (!valid) {
    point.x = previous.x
    point.y = previous.y
    return false
  }
  return true
}

function handleSelection(point: Vec2): void {
  const current = getActivePolygon()
  if (current) {
    const index = current.findPointIndex(point, ACTIVE_LIMIT)
    if (index >= 0) {
      activatePolygon(current)
      current.setActivePoint(index)
      dragMode = 'point'
      return
    }
  }
  for (let index = polygons.length - 1; index >= 0; index -= 1) {
    const polygon = polygons[index]
    if (!polygon.isClosed) continue
    const pointIndex = polygon.findPointIndex(point, ACTIVE_LIMIT)
    if (pointIndex >= 0) {
      activatePolygon(polygon)
      polygon.setActivePoint(pointIndex)
      dragMode = 'point'
      return
    }
    if (polygon.contains(point)) {
      activatePolygon(polygon)
      dragMode = 'polygon'
      return
    }
  }
  clearActivation()
  dragMode = 'none'
}

function onPointerDown(event: PointerEvent): void {
  if (event.button === 2) {
    cancelDrawing()
    return
  }
  if (event.button !== 0 && event.button !== 1) return
  const raw = getPosition(event)
  const point = clampPoint(raw)
  lastPointer = raw
  cursor = point
  pointerId = event.pointerId

  const canvas = markCanvas.value
  if (canvas && typeof canvas.setPointerCapture === 'function') {
    canvas.setPointerCapture(event.pointerId)
  }

  if (props.markState) {
    const drawing = getDrawingPolygon()
    if (drawing) {
      const first = drawing.first
      const last = drawing.last
      if (first && drawing.points.length >= MIN_POINTS && distance(point, first) <= CLOSE_LIMIT) {
        finishDrawing(drawing)
      } else if (polylineSelfIntersectsOnAppend(drawing.points, point)) {
        emitNotice('新线段不能与自身已有边交叉')
      } else if (last && crossesExistingPolygons(last, point)) {
        emitNotice('新线段不能与已有图形交叉或重叠')
      } else {
        drawing.add(new Point(point.x, point.y))
      }
    } else if (
      !props.allowOverlap &&
      polygons.some((polygon) => polygon.isClosed && isPointInPolygon(point, polygon.points))
    ) {
      emitNotice('不能在已有图形内部开始新图形')
    } else {
      const polygon = new Polygon(props.description)
      polygon.add(new Point(point.x, point.y))
      polygons.push(polygon)
      statusText.value = '开始绘制新图形'
    }
  } else {
    handleSelection(point)
  }
  scheduleDraw()
}

function onPointerMove(event: PointerEvent): void {
  const raw = getPosition(event)
  const next = clampPoint(raw)
  cursor = next
  if (dragMode === 'point' && activePolygon) {
    const index = activePolygon.points.findIndex((point) => point.isActive())
    if (index >= 0 && !tryMovePoint(activePolygon, index, next)) {
      emitNotice('顶点不能越界、交叉或与其它图形重叠')
    }
  } else if (dragMode === 'polygon' && activePolygon && lastPointer) {
    slideTranslate(activePolygon, raw.x - lastPointer.x, raw.y - lastPointer.y)
  }
  // 无论位移是否被拒绝都跟随真实指针，否则反向拖动要先抵消无效位移，产生不跟手的死区
  if (lastPointer) lastPointer = raw
  scheduleDraw()
}

function onPointerUp(): void {
  const canvas = markCanvas.value
  if (pointerId !== null && canvas && typeof canvas.releasePointerCapture === 'function') {
    try {
      canvas.releasePointerCapture(pointerId)
    } catch {
      // 指针捕获可能已由浏览器释放
    }
  }
  pointerId = null
  lastPointer = null
  if (dragMode !== 'none') {
    activePolygon?.clearActivePoint()
    emit('change', toDataset())
  }
  dragMode = 'none'
  scheduleDraw()
}

function onPointerLeave(): void {
  if (dragMode !== 'none' || pointerId !== null) return
  cursor = null
  emitCursor()
  scheduleDraw()
}

function onKeyDown(event: KeyboardEvent): void {
  const drawing = getDrawingPolygon()
  const deltas: Record<string, [number, number]> = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  }
  switch (event.key) {
    case 'Enter':
      if (props.markState && drawing) {
        event.preventDefault()
        finishDrawing(drawing)
      }
      break
    case 'Escape':
      event.preventDefault()
      cancelDrawing()
      break
    case 'Delete':
    case 'Backspace':
      event.preventDefault()
      deleteActive()
      break
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight': {
      if (!activePolygon) break
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      const delta = deltas[event.key]
      if (tryTranslate(activePolygon, delta[0] * step, delta[1] * step)) {
        emit('change', toDataset())
        scheduleDraw()
      }
      break
    }
    default:
      break
  }
}

watch(
  () => [props.width, props.height, props.initPolygons] as const,
  ([nextWidth, nextHeight, nextData], [prevWidth, prevHeight, prevData]) => {
    void nextTick(() => {
      if (nextWidth !== prevWidth || nextHeight !== prevHeight) {
        setupCanvas()
        drawBackground()
      }
      // 只有恢复/缩放时替换数据集；尺寸变化不再覆盖未保存的编辑
      if (nextData !== prevData) {
        polygons = datasetToPolygons(nextData ?? [])
        activePolygon = null
        dragMode = 'none'
        cursor = null
        statusText.value = `已载入 ${polygons.length} 个图形`
      }
      drawMarks()
    })
  },
)

watch(
  () => props.imageSrc,
  () => loadImage(),
)

watch(
  () => props.markState,
  (enabled) => {
    if (!enabled) discardDrawing()
  },
)

watch(
  () => [props.lineColor, props.fontSize, props.description] as const,
  () => scheduleDraw(),
)

onMounted(() => {
  setupCanvas()
  polygons = datasetToPolygons(props.initPolygons ?? [])
  loadImage()
  drawBackground()
  drawMarks()
})

onBeforeUnmount(() => {
  if (frameHandle) cancelFrame(frameHandle)
  if (imageElement) {
    imageElement.onload = null
    imageElement.onerror = null
  }
})

defineExpose({ deleteActive, toDataset, clearAll, focusCanvas, cancelDrawing })
</script>

<style scoped>
.canvas-host {
  position: relative;
  display: block;
  max-width: 100%;
  margin: 0 auto;
  overflow: hidden;
  background: #e8edf7;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  touch-action: none;
}

.canvas-layer {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.canvas-background {
  z-index: 0;
}

.canvas-mark {
  z-index: 1;
  cursor: grab;
  touch-action: none;
}

.is-marking .canvas-mark {
  cursor: crosshair;
}

.canvas-mark:focus-visible {
  outline: 3px solid #f59e0b;
  outline-offset: -3px;
}
</style>
