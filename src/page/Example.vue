<template>
    <div>
        <button style="width: auto;" :style="{color: markState ? 'yellow' : ''}"
                @click="toggleMarkState">标注
        </button>
        <button style="width: auto" @click="deleteMark">删除</button>
        <button style="width: auto" @click="saveMark">保存</button>
        <button style="width: auto" @click="recoverMark">恢复</button>
        <button style="width: auto" @click="scaleMark">缩放(x1)</button>
        <span>光标在标注区域坐标(x, y)：({{cursor.x}}, {{cursor.y}})</span>
        <MyCanvas ref="myCanvas"
                  :width="width"
                  :height="height"
                  :lineColor="lineColor"
                  :fontSize="fontSize"
                  :image="canvasImg"
                  :markState="markState"
                  :initPolygons="initPolygons"
                  :description="description"
                  :emitCursorPosition="true"
                  @cursorPosition="cursorPosition"
                  @markClosed="markClose"
                  @draggingDot="draggingDot"></MyCanvas>
    </div>
</template>

<script>
  import Vue from 'vue'
  import MyCanvas from '../components/MyCanvas.vue';
  import imageSrc from '../assets/back.png';
  import {mapState, mapMutations, mapGetters} from 'vuex';
  import * as types from '@/store/mutation-types';

  export default {
    name: 'Demo',
    data() {
      return {
        imgSrc: imageSrc,
        canvasImg: null,
        width: 0,
        height: 0,
        lineColor: 'purple',            //格式为”red“,"green",”blue“,"purple", "white"等语义化颜色
        fontSize: 16,
        initPolygons: [],
        description: 'Text desc',
        dataset: [],                   //标注保存的数据格式
        cursor: {},
        scaleState: false,
      }
    },
    mounted() {
      let imageObj = new Image();
      imageObj.onload = () => {
        let width = imageObj.width,
          height = imageObj.height;
        this.width = width;
        this.height = height;
        console.log('image width=%d; height=%d', this.width, this.height);
        this.canvasImg = imageObj

      };
      imageObj.onerror = () => {
        console.log('imageObj onerror ');
      };
      imageObj.src = this.imgSrc;
    },
    components: {
      MyCanvas
    },
    computed: {
      ...mapState({
        markState: state => state.myCanvas.markState,

      }),
      ...mapGetters([]),
    },

    methods: {
      ...mapMutations({
        changeMarkState: types.CHANGE_MARK_STATE,
      }),

      toggleMarkState() {
        this.changeMarkState(!this.markState);
      },
      deleteMark() {
        this.$refs.myCanvas.deleteMark();
        //need to update initPolygons dataset too
        this.initPolygons = Array.from(this.$refs.myCanvas.toDataset());
      },
      saveMark() {
        let dataset = this.$refs.myCanvas.toDataset();
        this.dataset = dataset;
      },
      recoverMark() {
        this.initPolygons = Array.from(this.dataset);
      },
      cursorPosition() {
        this.cursor = arguments[0];
      },
      scaleMark() {
        //you need to save the dateset first, then scale the initPolygons data
        this.saveMark();
        if (this.dataset.length > 0) {
          this.dataset = this.dataset.map((set) => {
            let points = set.points;
            set.points = points.map((p) => {
              if (this.scaleState) {
                p.x *= 2;
                p.y *= 2;
              } else {
                p.x /= 2;
                p.y /= 2;
              }
              return p;
            });
            return set;
          })
        }
        ;
        this.recoverMark();

        if (this.scaleState) {
          this.width *= 2;
          this.height *= 2;
          this.fontSize += 4;
        } else {
          this.width /= 2;
          this.height /= 2;
          this.fontSize -= 4;
        }
        this.scaleState = !this.scaleState;
      },
      markClose() {
        console.log('this is the ' + arguments[0] + ' polygon(s)');
      },
      draggingDot() {
        console.log('you are dragging dot');
      }
    }
  }
</script>
