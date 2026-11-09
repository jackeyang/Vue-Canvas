import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MyCanvas from '@/components/MyCanvas.vue'
import type { Dataset } from '@/common/types'

const baseProps = { width: 300, height: 200, markState: true }

const squareDataset: Dataset = [
  {
    points: [
      { x: 100, y: 50 },
      { x: 140, y: 50 },
      { x: 140, y: 90 },
      { x: 100, y: 90 },
    ],
    text: '区域',
  },
]

async function startDrag(mark: Element, x: number, y: number): Promise<void> {
  firePointer(mark, 'pointerdown', x, y)
  await nextTick()
}

async function movePointer(mark: Element, x: number, y: number): Promise<void> {
  firePointer(mark, 'pointermove', x, y)
  await nextTick()
}

function createContextStub() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    lineDashOffset: 0,
    lineWidth: 1,
    lineJoin: '',
    lineCap: '',
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  }
}

interface CanvasVm {
  toDataset: () => Dataset
  deleteActive: () => boolean
  clearAll: () => void
}

function exposed(wrapper: { vm: unknown }): CanvasVm {
  return wrapper.vm as unknown as CanvasVm
}

/** jsdom 没有 PointerEvent，且 MouseEvent.button 是只读 getter，因此直接派发原生事件 */
function firePointer(element: Element, type: string, x: number, y: number, button = 0): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: button },
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: 1 },
  })
  element.dispatchEvent(event)
}

function fireKey(element: Element, key: string): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

async function addPoint(mark: Element, x: number, y: number): Promise<void> {
  firePointer(mark, 'pointerdown', x, y)
  firePointer(mark, 'pointerup', x, y)
  await nextTick()
}

async function drawTriangle(mark: Element): Promise<void> {
  await addPoint(mark, 10, 10)
  await addPoint(mark, 100, 10)
  await addPoint(mark, 100, 100)
  await addPoint(mark, 12, 12)
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => createContextStub() as unknown as CanvasRenderingContext2D,
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MyCanvas', () => {
  it('同一应用内两个实例不共享画布、说明 id 与图形数据', async () => {
    const Host = defineComponent({
      setup() {
        return () => h('div', [h(MyCanvas, { ...baseProps }), h(MyCanvas, { ...baseProps })])
      },
    })
    const host = mount(Host)
    const instances = host.findAllComponents(MyCanvas)
    expect(instances).toHaveLength(2)

    const ids = host.findAll('.sr-only[id]').map((node) => node.attributes('id'))
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(instances[0].find('.canvas-background').element).not.toBe(
      instances[1].find('.canvas-background').element,
    )

    await drawTriangle(instances[0].find('.canvas-mark').element)
    expect(exposed(instances[0]).toDataset()).toHaveLength(1)
    expect(exposed(instances[1]).toDataset()).toHaveLength(0)
  })

  it('逐点绘制、靠近起点自动闭合并上抛事件', async () => {
    const wrapper = mount(MyCanvas, { props: { ...baseProps, description: '区域 A' } })
    await drawTriangle(wrapper.find('.canvas-mark').element)

    const dataset = exposed(wrapper).toDataset()
    expect(dataset).toHaveLength(1)
    expect(dataset[0].text).toBe('区域 A')
    expect(dataset[0].points).toHaveLength(3)
    expect(wrapper.emitted('markClosed')).toHaveLength(1)
    expect(wrapper.emitted('change')?.length).toBeGreaterThan(0)
  })

  it('Escape 取消绘制，Enter 直接闭合', async () => {
    const cancelled = mount(MyCanvas, { props: baseProps })
    const cancelledMark = cancelled.find('.canvas-mark').element
    await addPoint(cancelledMark, 10, 10)
    fireKey(cancelledMark, 'Escape')
    await nextTick()
    expect(exposed(cancelled).toDataset()).toHaveLength(0)

    const closed = mount(MyCanvas, { props: baseProps })
    const closedMark = closed.find('.canvas-mark').element
    await addPoint(closedMark, 10, 10)
    await addPoint(closedMark, 100, 10)
    await addPoint(closedMark, 100, 100)
    fireKey(closedMark, 'Enter')
    await nextTick()
    expect(exposed(closed).toDataset()).toHaveLength(1)
  })

  it('拒绝在已有图形内部开始新图形', async () => {
    const wrapper = mount(MyCanvas, { props: baseProps })
    const mark = wrapper.find('.canvas-mark').element
    await drawTriangle(mark)
    await addPoint(mark, 80, 30)

    expect(wrapper.emitted('notice')?.flat()).toContain('不能在已有图形内部开始新图形')
    expect(exposed(wrapper).toDataset()).toHaveLength(1)
  })

  it('对外方法删除与清空图形', async () => {
    const wrapper = mount(MyCanvas, { props: baseProps })
    const mark = wrapper.find('.canvas-mark').element
    await drawTriangle(mark)
    expect(exposed(wrapper).deleteActive()).toBe(true)
    expect(exposed(wrapper).toDataset()).toHaveLength(0)

    await drawTriangle(mark)
    exposed(wrapper).clearAll()
    expect(exposed(wrapper).toDataset()).toHaveLength(0)
  })

  it('右键取消未闭合图形', async () => {
    const wrapper = mount(MyCanvas, { props: baseProps })
    await addPoint(wrapper.find('.canvas-mark').element, 10, 10)
    wrapper
      .find('.canvas-host')
      .element.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(exposed(wrapper).toDataset()).toHaveLength(0)
  })

  it('与已有图形分离的第二个多边形可以正常闭合', async () => {
    const wrapper = mount(MyCanvas, { props: baseProps })
    const mark = wrapper.find('.canvas-mark').element
    await drawTriangle(mark)
    await addPoint(mark, 160, 10)
    await addPoint(mark, 260, 10)
    await addPoint(mark, 260, 100)
    await addPoint(mark, 162, 12)

    const dataset = exposed(wrapper).toDataset()
    expect(dataset).toHaveLength(2)
    expect(dataset[1].points).toHaveLength(3)
  })

  it('绘制第二个多边形时逐点拒绝与已有图形交叉的线段', async () => {
    const wrapper = mount(MyCanvas, { props: baseProps })
    const mark = wrapper.find('.canvas-mark').element
    await drawTriangle(mark)
    await addPoint(mark, 150, 50)
    await addPoint(mark, 50, 50)

    expect(wrapper.emitted('notice')?.flat()).toContain('新线段不能与已有图形交叉或重叠')

    await addPoint(mark, 250, 50)
    await addPoint(mark, 250, 120)
    await addPoint(mark, 152, 52)

    const dataset = exposed(wrapper).toDataset()
    expect(dataset).toHaveLength(2)
    expect(dataset[1].points).toHaveLength(3)
  })

  it('闭合边与已有图形交叉时拒绝闭合', async () => {
    const wrapper = mount(MyCanvas, { props: baseProps })
    const mark = wrapper.find('.canvas-mark').element
    await drawTriangle(mark)
    await addPoint(mark, 5, 5)
    await addPoint(mark, 200, 5)
    await addPoint(mark, 200, 200)
    await addPoint(mark, 7, 7)

    expect(wrapper.emitted('notice')?.flat()).toContain('闭合边不能与已有图形交叉或重叠')
    expect(exposed(wrapper).toDataset()).toHaveLength(1)
  })

  it('allowOverlap 开启时允许第二个图形与已有图形交叉', async () => {
    const wrapper = mount(MyCanvas, { props: { ...baseProps, allowOverlap: true } })
    const mark = wrapper.find('.canvas-mark').element
    await drawTriangle(mark)
    await addPoint(mark, 150, 50)
    await addPoint(mark, 50, 50)
    await addPoint(mark, 50, 150)
    await addPoint(mark, 152, 52)

    expect(exposed(wrapper).toDataset()).toHaveLength(2)
  })

  it('贴住边界后继续向外拖动不漂移，反向拖动立即响应', async () => {
    const wrapper = mount(MyCanvas, {
      props: { ...baseProps, markState: false, initPolygons: squareDataset },
    })
    const mark = wrapper.find('.canvas-mark').element
    await startDrag(mark, 120, 70)
    await movePointer(mark, 400, 70)
    expect(exposed(wrapper).toDataset()[0].points[0].x).toBe(260)

    await movePointer(mark, 500, 70)
    expect(exposed(wrapper).toDataset()[0].points[0].x).toBe(260)

    await movePointer(mark, 490, 70)
    expect(exposed(wrapper).toDataset()[0].points[0].x).toBe(250)
  })

  it('拖到画布外后反向移动不会被裁剪坐标吃掉', async () => {
    const wrapper = mount(MyCanvas, {
      props: { ...baseProps, markState: false, initPolygons: squareDataset },
    })
    const mark = wrapper.find('.canvas-mark').element
    await startDrag(mark, 120, 70)
    await movePointer(mark, 400, 70)
    expect(exposed(wrapper).toDataset()[0].points[0].x).toBe(260)

    // 350 与 400 都会被 clamp 到画布右边界，但真实指针增量是 -50
    await movePointer(mark, 350, 70)
    expect(exposed(wrapper).toDataset()[0].points[0].x).toBe(210)

    await movePointer(mark, 330, 70)
    expect(exposed(wrapper).toDataset()[0].points[0].x).toBe(190)
  })

  it('贴住 x 边界后仍可沿 y 方向拖动', async () => {
    const wrapper = mount(MyCanvas, {
      props: { ...baseProps, markState: false, initPolygons: squareDataset },
    })
    const mark = wrapper.find('.canvas-mark').element
    await startDrag(mark, 120, 70)
    await movePointer(mark, 400, 70)
    expect(exposed(wrapper).toDataset()[0].points[0].x).toBe(260)

    await movePointer(mark, 400, 95)
    expect(exposed(wrapper).toDataset()[0].points[0].x).toBe(260)
    expect(exposed(wrapper).toDataset()[0].points[0].y).toBe(75)
  })
})
