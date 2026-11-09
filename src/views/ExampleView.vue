<template>
  <main id="main-content" class="page">
    <header class="page-header">
      <h1>Vue 3 · Canvas 多边形标注</h1>
      <p class="subtitle">逐点绘制、自动闭合、顶点微调、整体平移、缩放与数据导入导出。</p>
    </header>

    <section class="toolbar" aria-label="标注工具栏">
      <div class="toolbar-group" role="group" aria-label="绘制操作">
        <button
          type="button"
          class="button primary"
          :class="{ active: store.markState }"
          :aria-pressed="store.markState"
          @click="store.toggleMark()"
        >
          {{ store.markState ? '结束标注' : '开始标注' }}
        </button>
        <button type="button" class="button danger" @click="onDelete">删除选中</button>
        <button type="button" class="button" @click="onClear">清空</button>
      </div>

      <div class="toolbar-group" role="group" aria-label="数据操作">
        <button type="button" class="button" :disabled="!store.hasPolygons" @click="onSave">
          保存到本地
        </button>
        <button
          type="button"
          class="button"
          :disabled="!store.hasSnapshot"
          @click="store.recover()"
        >
          恢复图形
        </button>
        <button type="button" class="button" :disabled="!store.hasPolygons" @click="onExport">
          导出 JSON
        </button>
        <button type="button" class="button" @click="openFilePicker">导入 JSON</button>
        <input
          ref="fileInput"
          class="sr-only"
          type="file"
          accept="application/json,.json"
          tabindex="-1"
          aria-hidden="true"
          @change="onFileChange"
        />
      </div>

      <div class="toolbar-group" role="group" aria-label="画布缩放">
        <button type="button" class="button" :disabled="!store.canZoomOut" @click="store.zoom(0.5)">
          缩小
        </button>
        <span class="scale-badge" aria-label="当前缩放倍率">{{ store.scaleLabel }}</span>
        <button type="button" class="button" :disabled="!store.canZoomIn" @click="store.zoom(2)">
          放大
        </button>
      </div>
    </section>

    <p class="status" role="status" aria-live="polite">{{ store.notice || '准备就绪' }}</p>

    <section class="canvas-area" aria-label="标注画布区域">
      <MyCanvas
        ref="canvasRef"
        :width="store.width"
        :height="store.height"
        :mark-state="store.markState"
        :image-src="store.imageSrc"
        :line-color="store.lineColor"
        :font-size="store.fontSize"
        :init-polygons="store.initPolygons"
        :description="store.description"
        :emit-cursor-position="true"
        :allow-overlap="false"
        aria-label="多边形标注画布"
        @change="onChange"
        @mark-closed="onMarkClosed"
        @cursor-position="onCursor"
        @notice="onNotice"
      />
    </section>

    <footer class="meta">
      <span>光标：{{ store.cursor ? `${store.cursor.x}, ${store.cursor.y}` : '—' }}</span>
      <span>图形数：{{ store.dataset.length }}</span>
      <span>已保存：{{ store.savedCount }}</span>
      <span>缩放：{{ store.scaleLabel }}</span>
    </footer>

    <p class="hints">
      标注模式下逐点点击，靠近起点自动闭合；按 Enter 闭合、Escape 取消、Delete
      删除选中图形、方向键（Shift 加速）移动选中图形；非标注模式下可点击选中、拖动顶点或整体平移。
    </p>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MyCanvas from '@/components/MyCanvas.vue'
import { parseDatasetJson } from '@/common/dataset'
import { useAnnotationStore } from '@/stores/annotation'
import type { CursorPosition, Dataset } from '@/common/types'

interface CanvasExpose {
  deleteActive: () => boolean
  clearAll: () => void
  toDataset: () => Dataset
}

const store = useAnnotationStore()
const canvasRef = ref<CanvasExpose | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function onSave(): void {
  store.saveToLocal(canvasRef.value?.toDataset())
}

function onDelete(): void {
  canvasRef.value?.deleteActive()
}

function onClear(): void {
  canvasRef.value?.clearAll()
  store.setNotice('画布已清空')
}

function onChange(dataset: Dataset): void {
  store.setDataset(dataset)
}

function onMarkClosed(): void {
  store.setNotice('图形已闭合')
}

function onCursor(position: CursorPosition | null): void {
  store.setCursor(position)
}

function onNotice(message: string): void {
  store.setNotice(message)
}

function onExport(): void {
  const blob = new Blob([JSON.stringify(store.dataset, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'annotation-dataset.json'
  link.click()
  URL.revokeObjectURL(url)
  store.setNotice(`已导出 ${store.dataset.length} 个图形`)
}

function openFilePicker(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const data = parseDatasetJson(await file.text())
    store.applyImported(data)
  } catch (error) {
    store.setNotice(error instanceof Error ? error.message : '导入失败')
  } finally {
    input.value = ''
  }
}

onMounted(() => {
  const count = store.loadPersisted()
  if (count > 0) store.setNotice(`已载入本地保存的 ${count} 个图形`)
})
</script>

<style scoped>
.page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 28px 16px 48px;
}

.page-header {
  margin-bottom: 20px;
}

h1 {
  margin: 0 0 8px;
  font-size: clamp(1.4rem, 3vw, 2rem);
}

.subtitle {
  margin: 0;
  color: var(--color-muted);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.toolbar-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.button {
  padding: 7px 14px;
  color: var(--color-text);
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.button:hover:not(:disabled) {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.65;
}

.button.primary {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.button.primary.active {
  background: #0f766e;
  border-color: #0f766e;
}

.button.danger:hover:not(:disabled) {
  color: var(--color-danger);
  background: #fee2e2;
  border-color: var(--color-danger);
}

.scale-badge {
  min-width: 44px;
  padding: 4px 8px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  background: var(--color-primary-soft);
  border-radius: 6px;
}

.status {
  min-height: 1.5em;
  margin: 0 0 12px;
  color: var(--color-primary);
  font-size: 0.9rem;
}

.canvas-area {
  padding: 12px;
  overflow: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 6%);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  color: var(--color-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.hints {
  margin: 16px 0 0;
  color: var(--color-muted);
  font-size: 0.875rem;
  line-height: 1.7;
}

@media (max-width: 640px) {
  .toolbar-group {
    width: 100%;
  }

  .button {
    flex: 1 1 auto;
  }
}
</style>
