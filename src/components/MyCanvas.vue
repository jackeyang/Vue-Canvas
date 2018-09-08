<template>
    <div style="position:relative; display: block; margin: auto;"
         :style="{'height': height + 'px', 'width': width + 'px' }"
         @contextmenu.stop.prevent="prevent">
        <canvas id="canvas_background" :width="width" :height="height"></canvas>
        <canvas id="canvas_for_mark"
                :width="width"
                :height="height"
                @mousedown="mousedown($event)"
                @mousemove="mousemove($event)"
                @mouseup="mouseup($event)"
                @click="dot($event)"></canvas>
    </div>
</template>

<script>
  import Point from '../common/Point';
  import Polygon from '../common/Polygon';
  import {deepCopy} from '../common/util';
  import {POLYGON_STATUS, LIMIT, ACTIVE_LIMIT, POINT_STATUS} from '@/common/constants';

  export default {
    name: 'my-canvas',
    data () {
      return {
        back_canvas: null,        //标注背景
        back_context: null,       //背景上下文
        canvas: null,             //绘图canvas
        context: null,            //绘图上下文
        polygons: [],             //标注的多边形数组
        isLeftBtnDown: false,     //记录左键是否处于按下
      }
    },
    props: {
      width: Number,
      height: Number,
      lineColor: String,
      fontSize: Number,
      image: {},
      markState: {                //非标注状态下，只可激活、删除多边形
        type: Boolean,
        required: true
      },
      initPolygons: {
        type: Array
      },
      description: {
        type: String,
      },
      emitCursorPosition: {
        type: Boolean,
        default: false
      }

    },
    mounted() {

      this.back_canvas = document.querySelector('#canvas_background');
      this.back_context = this.back_canvas.getContext('2d');

      this.canvas = document.querySelector('#canvas_for_mark');
      this.context = this.canvas.getContext('2d');
      if (this.image) {
        this.back_context.drawImage(this.image, 0, 0, this.width, this.height);
      }

      this.polygons = this.readFromDataset(this.initPolygons);

    },

    watch: {
      markState: function(newState) {
        if (!newState) {
          this.polygons.forEach(polygon => {
            if (polygon.status == POLYGON_STATUS.DRAWING) polygon.status = POLYGON_STATUS.DELETE;
            polygon.isActive = false;
          });
          this.reDrawPolygon();
        }
      },
      image: function(newImage) {
        window.setTimeout(() => {
          this.back_context.drawImage(newImage, 0, 0, this.width, this.height);
        }, 0);
      },
      height: function(h) {
        if (this.image) {
          window.setTimeout(() => {
            if (h > 1) {
              this.back_context.drawImage(this.image, 0, 0, this.width, h);
              this.polygons = this.readFromDataset(this.initPolygons);
              this.reDrawPolygon();
            }
          }, 0)
        }
      },
      width: function(w) {
        if (this.image) {
          window.setTimeout(() => {
            if (w > 1) {
              this.back_context.drawImage(this.image, 0, 0, w, this.height);
              this.polygons = this.readFromDataset(this.initPolygons);
              this.reDrawPolygon();
            }
          }, 0);
        }
      },
      initPolygons: function(newDataset) {
        this.polygons = this.readFromDataset(newDataset);
        this.reDrawPolygon();
      },
      description: function(text) {
        this.description = text;
      },
      fontSize: function(size) {
        this.fontSize = size;
      },
      lineColor: function(color) {
        this.lineColor = color;
      }
    },
    computed: {
      imageStyle() {
        return {
          width: this.width + 'px',
          height: this.height + 'px'
        }
      },
    },
    methods: {
      prevent() {
        return true;
      },

      deleteMark() {
//        if (!this.markState) return;
        this.polygons.forEach(polygon => {
          if (polygon.isActive) polygon.status = POLYGON_STATUS.DELETE;
        });
        this.reDrawPolygon();
      },
      /**
       * 左键：
       * 1, 检查是否有某个正在标注中的多边形，优先响应
       * 2，由点击事件重置多边形激活状态
       * 3，检查点击是否在多边形内部，以此来激活多边形
       * 4，开始标注新的多边形
       *
       * 右键或中间：取消当前操作
       */
      mousedown(event) {
        this.isLeftBtnDown = true;

        let point = new Point(this.x, this.y);

        //1. 优先响应
        if (this.hasDrawingStatusPolygon()) {

          let polygon = this.getDrawingStatusPolygon();

          if (event.button !== 0) { //中，右键
            polygon.status = POLYGON_STATUS.DELETE;
            this.reDrawPolygon();
            return;
          }

          //TODO:不允许画在其它图形内部?

          polygon.add(point);
          //判断是否需要闭合多边形
          if (polygon.points.length >= 3 && polygon.points[0].distance(point) < LIMIT) {
            polygon.status = POLYGON_STATUS.COMPLETE;
            this.$emit('markClosed', this.polygons.length);
          }
          return;
        }

        //2.重置多边形激活态
        if (event.button >= 1) return;
        let activedPoint = this.findActivePoint(point);
        //reset active state
        this.polygons.map(polygon => {
          if (polygon.points.includes(activedPoint)) return;
          polygon.isActive = false;
          polygon.points.map(point => point.status = POINT_STATUS.INACTIVE);
        });
        if (activedPoint) return;

        //3.查找是否点击在某个多边形内部
        let _polygon = this.findActivePolygon(point);
        if (_polygon) return;

        //only under markstate can draw new polygon
        if (!this.markState) return;
        //4.new polygo
        let polygon = new Polygon(this.description);
        polygon.add(new Point(this.x, this.y));
        polygon.isActive = true;
        polygon.status = POLYGON_STATUS.DRAWING;
        this.polygons.push(polygon);

      },

      mousemove(event) {

        if (this.emitCursorPosition) {
          this.$emit('cursorPosition', this.getCurrentCursorPosition());
        }

        //中键或左键 => 平移图像
        let activePolygon = this.getCompleteActivePolygon();
        if (activePolygon && (event.button === 1 || (event.button === 0 && this.isLeftBtnDown && !this.getActivePoint()))) {
          let deltaX = event.offsetX - this.x,
            deltaY = event.offsetY - this.y;
          //forbidden overstep the boundary
          let isOverBoundary = this.checkIfOverBoundary(activePolygon, deltaX, deltaY);
          if (!isOverBoundary) {
            activePolygon.points.map((point) => {
              point.x += deltaX;
              point.y += deltaY;
            });
            this.reDrawPolygon();
          }
        }
        this.x = event.offsetX;
        this.y = event.offsetY;

        //判断是否需要track当前位置
        if (this.needTracking()) {
          return this.reDrawPolygon();
        }

        //左键 =>移动激活点
        let activedPoint = this.getActivePoint();
        if (activedPoint && event.button === 0) {
          activedPoint.x = this.x;
          activedPoint.y = this.y;
          this.$emit('draggingDot');
          return this.reDrawPolygon();
        }
      },

      mouseup(event) {
        this.isLeftBtnDown = false;
        let activedPoint = this.getActivePoint();
        if (activedPoint) activedPoint.status = POINT_STATUS.INACTIVE;
      },

      dot(event) {
//        console.log(`point at (${this.x}, ${this.y})`);
//        if (!this.markState) return;

        this.reDrawPolygon();
      },

      clearCanvas() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      },

      reDrawPolygon() {
        this.clearCanvas();
        console.log('will redraw');
        this.polygons = this.polygons.filter((polygon) => {
          return polygon.status !== POLYGON_STATUS.DELETE;
        });
        this.polygons.forEach(polygon => {
          polygon.draw(this.context, new Point(this.x, this.y), this.fontSize, this.lineColor);
        });
      },

      getActivePolygon() {
        return this.polygons.find((polygon) => {
          if (polygon.isActive) {
            return true;
          }
          return false;
        });
      },
      /**
       * 读取当前激活的封闭多边形
       */
      getCompleteActivePolygon() {
        let polygon = this.getActivePolygon();
        if (polygon && polygon.status === POLYGON_STATUS.COMPLETE) {
          return polygon;
        }
        return null;
      },
      checkIfOverBoundary(polygon, deltaX, deltaY) {
        let isOverBoundary;
        isOverBoundary = polygon.points.some((point) => {
          if (point.x + deltaX < 0 || point.x + deltaX > this.width || point.y + deltaY < 0 || point.y + deltaY >
            this.height) {
            return true;
          }
        });
        return isOverBoundary;
      },
      /**
       * 是否有激活状态多边形
       */
      hasActivePolygon() {
        return this.polygons.some((polygon) => {
          return polygon.isActive;
        })
      },
      /**
       * 由当前点寻找现有多边形的激活点
       */
      findActivePoint(p) {
        let boolean = false,
          activedPoint = null;

        boolean = this.polygons.some((polygon) => {
          let points = polygon.points;
          let b = false;
          b = points.some((point) => {
            if (point.distance(p) <= ACTIVE_LIMIT) {
              activedPoint = point;
              activedPoint.status = POINT_STATUS.ACTIVE;
              return true;
            }
          });
          if (b) polygon.isActive = true;
          return b;
        });
        return activedPoint;
      },
      /**
       * 由当前点寻找激活的多变边形
       */
      findActivePolygon(p) {
        let _polygon = null;
        this.clearCanvas();         //need to clear first
        this.polygons.forEach((polygon) => {
          polygon.draw(this.context, new Point(this.x, this.y), this.fontSize, this.lineColor);
          if (this.context.isPointInPath(p.x, p.y)) {
            _polygon = polygon;
            _polygon.isActive = true;
          }
        });
        return _polygon;
      },
      /**
       * 获取激活态的点
       */
      getActivePoint() {
        let activedPoint = null;
        for (let i = 0, len = this.polygons.length; i < len; i++) {
          let polygon = this.polygons[i],
            b = false;
          b = polygon.points.some((point) => {
            if (point.status === POINT_STATUS.ACTIVE) {
              activedPoint = point;
              return true;
            }
          });
          if (b) return activedPoint;
        }
        return activedPoint;
      },
      /**
       * 是否需要创建一个新的多边形
       */
      shouldNewPolygon(event) {
        if (!this.markState) return false;
        if (event.button > 0) return false;
        return !this.findActivePoint(new Point(event.offsetX, event.offsetY));
      },
      /**
       * 是否存在绘制状态中的多边形
       * @returns {*}
       */
      hasDrawingStatusPolygon() {
        if (!this.hasActivePolygon()) return false;
        return this.getActivePolygon().status === POLYGON_STATUS.DRAWING;
      },
      /**
       * 获取处于绘制中的多边形
       */
      getDrawingStatusPolygon() {
        return this.polygons.find((polygon) => {
          if (polygon.isActive && polygon.status === POLYGON_STATUS.DRAWING) {
            return true;
          }
          return false;
        });
      },
      /**
       * 是否需要追踪当前位置
       */
      needTracking() {
        if (!this.markState) return false;
        if (!this.hasDrawingStatusPolygon()) return false;
        return true;
      },
      /**
       *
       */
      getCurrentCursorPosition() {
        return {
          x: this.x,
          y: this.y
        }
      },
      /**
       * 从数据集中恢复
       */
      readFromDataset(json) {
        let polygons = [];
        if (!Array.isArray(json)) return polygons;
        json.forEach((polygon) => {
          let polygon_tmp = new Polygon();
          polygon_tmp.readFromDataset(polygon);
          polygons.push(polygon_tmp);
        });
//        console.log('polygons readFromDataset', polygons);
        return polygons;
      },
      /**
       * 导出当前标注信息
       * 仅导出封闭状态的图像数据
       */
      toDataset() {
        let dataset = [];
        this.polygons.forEach((polygon) => {
          if (polygon.status === POLYGON_STATUS.COMPLETE) {
            dataset.push(polygon.toDataset());
          }
        });
//        console.log('polygons dataset', dataset);
        return dataset;
      }
    },
  }
</script>

<style>

    #canvas_background {
        position: relative;
        margin: auto;
        padding: 0;
    }

    #canvas_for_mark {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 2;
        margin: auto;
        padding: 0;
    }


</style>