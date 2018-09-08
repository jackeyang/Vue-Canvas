import {RADIUS, POLYGON_STATUS, POINT_STATUS, POINT_COLOR, FILL_STYLE, TEXT_STYLE, POLYGON_LINE_COLOR} from '@/common/constants';
import Point from '@/common/Point';
export default class Ploygon {

  constructor(text = '') {
    this.points = [];                      //点集
    this.text = text;                      //文案描述
    this.fontSize = 14;                    //文案字体大小，默认14px
    this.isActive = false;                 //是否处于激活态，激活态优先响应事件
    this.status = POLYGON_STATUS.DRAWING;  //多边形状态，默认处于绘制状态
  }

  add(point) {
    this.points.push(point);
  }

  draw(ctx, currentPoint, fontSize, lineColor) {
    if(fontSize && +fontSize > 0) this.fontSize = fontSize;

    this.drawWriteDot(ctx);

    //line track
    if (this.status === POLYGON_STATUS.DRAWING) {
      this.drawLine(ctx, this.points, lineColor, this.status === POLYGON_STATUS.COMPLETE);

      let endPoint = this.points[this.points.length - 1];
      ctx.setLineDash([2, 2]);
      ctx.lineDashOffset = 0;
      ctx.beginPath();
      ctx.moveTo(endPoint.x, endPoint.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();
    }

    if (this.status === POLYGON_STATUS.COMPLETE) {
      this.dragTrack(ctx, lineColor);
    }


  }

  /**
   * 描绘多边形
   * @param ctx
   * @param points
   * @param lineColor  多变形颜色种类
   * @param close
   */
  drawLine(ctx, points, lineColor, close = false) {
    let color = lineColor && POLYGON_LINE_COLOR[lineColor] ? POLYGON_LINE_COLOR[lineColor] : POLYGON_LINE_COLOR['normal'];
    // console.log(color);
    ctx.strokeStyle = color.NORMAL;
    if(this.isActive) ctx.strokeStyle = color.ACTIVE;
    ctx.setLineDash([1, 0]);
    ctx.beginPath();
    for (let i = 0, len = points.length; i < len; i++) {
      const point = points[i];
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }

    // 是否需要封闭
    if (close) {
      ctx.closePath();
    }

    ctx.stroke();

    if(close) {
      this.drawText(ctx);
    }
  }

  drawWriteDot(ctx) {

    for (let i = 0, len = this.points.length; i < len; i++) {
      ctx.beginPath();
      ctx.fillStyle = POINT_COLOR.NORMAL;
      const point = this.points[i];
      if(point.status === POINT_STATUS.ACTIVE) {
        ctx.fillStyle = POINT_COLOR.ACTIVE;
      }
      ctx.arc(point.x, point.y, RADIUS, 0, 2 * Math.PI, true);
      ctx.fill();
    }

  }

  /**
   * 拖动点修正轨迹
   * @param ctx
   * @param lineColor  多边形颜色类型
   * @returns {*}
   */
  dragTrack(ctx, lineColor) {
    let color = lineColor && POLYGON_LINE_COLOR[lineColor] ? POLYGON_LINE_COLOR[lineColor] : POLYGON_LINE_COLOR['normal'];

    let activedIndex = this.points.findIndex((point) => {
      return point.status === POINT_STATUS.ACTIVE
    });
    if (activedIndex === -1) {  //normal
      return this.drawLine(ctx, this.points, lineColor, true);
    }

    ctx.beginPath();
    ctx.strokeStyle = color.ACTIVE;
    ctx.setLineDash([2, 2]);
    ctx.setDashOffset = 0;
    if (activedIndex === 0) {
      ctx.moveTo(this.points[activedIndex].x, this.points[activedIndex].y);
      ctx.lineTo(this.points[1].x, this.points[1].y);
      ctx.moveTo(this.points[activedIndex].x, this.points[activedIndex].y);
      ctx.lineTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
    } else if (activedIndex === this.points.length - 1) {
      ctx.moveTo(this.points[activedIndex].x, this.points[activedIndex].y);
      ctx.lineTo(this.points[0].x, this.points[0].y);
      ctx.moveTo(this.points[activedIndex].x, this.points[activedIndex].y);
      ctx.lineTo(this.points[activedIndex - 1].x, this.points[activedIndex - 1].y);
    } else {
      ctx.moveTo(this.points[activedIndex].x, this.points[activedIndex].y);
      ctx.lineTo(this.points[activedIndex - 1].x, this.points[activedIndex - 1].y);
      ctx.moveTo(this.points[activedIndex].x, this.points[activedIndex].y);
      ctx.lineTo(this.points[activedIndex + 1].x, this.points[activedIndex + 1].y);
    }
    ctx.stroke();

    let array1 = this.points.slice(activedIndex + 1);
    let array2 = this.points.slice(0, activedIndex);
    let newArray = array1.concat(array2);
    // console.log('newArray', newArray);

    ctx.beginPath();
    ctx.strokeStyle = color.ACTIVE;
    ctx.setLineDash([2, 0]);
    ctx.setDashOffset = 0;

    this.drawLine(ctx, newArray, lineColor, false);

  }

  //draw description text
  drawText(ctx) {
    if(!this.text) return;
    let startPoint = this.findStartPoint();
    ctx.textBaseline = 'top';
    ctx.font = `${this.fontSize}px monospace`;
    let textM = ctx.measureText(this.text);
    // console.log('point', startPoint);
    // console.log('textMetrics', textM);

    // ctx.fillStyle = FILL_STYLE.BLACK;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(startPoint.x, startPoint.y, textM.width + 10, this.fontSize + 10);
    ctx.strokeStyle = TEXT_STYLE.WHITE;

    // console.log(ctx.font);
    ctx.lineWidth = 0.5;
    ctx.strokeText(this.text, startPoint.x + 5, startPoint.y + 5);
  }

  findStartPoint() {
    let p_maxX = new Point(0,0),
      p_maxY = new Point(0,0);
    this.points.forEach((p) => {
      if(p.x > p_maxX.x) p_maxX.readFromPoint(p);
      if(p.y > p_maxY.y) p_maxY.readFromPoint(p);
    });
    return new Point((p_maxX.x + p_maxY.x)/2, (p_maxX.y + p_maxY.y)/2);
  }

  /**
   * 从数据集中读出数据恢复
   */
  readFromDataset(json) {
    json.hasOwnProperty("text") && (this.text = json.text);
    if(json.hasOwnProperty("points")) {
      let points_tmp = [];
      json.points.forEach((p) => {
        let p_tmp = new Point();
        p_tmp.readFromDataset(p);
        points_tmp.push(p_tmp);
      });
      this.points = points_tmp;
    }
    this.isActive = false;
    this.status = POLYGON_STATUS.COMPLETE;
    // console.log('polygon readFromDataset polygon', this);
  }

  /**
   * 从多变形中导出数据集
   */
  toDataset() {
    let dataset = {};
    dataset.points = [];
    dataset.text = this.text || '';
    this.points.forEach((p) => {
      dataset.points.push(p.toDataset());
    });
    // console.log('polygon toDataset', dataset);
    return dataset;
  }

}