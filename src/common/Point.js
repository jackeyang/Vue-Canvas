import {POINT_STATUS} from '@/common/constants';

export default class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.status = POINT_STATUS.INACTIVE;    //默认为普通状态
  }

  distance(p) {
    return Math.sqrt(Math.pow((this.x - p.x), 2) + Math.pow((this.y - p.y), 2));
  }

  readFromPoint(p) {
    if(!p || !(p instanceof Point)) return;
    this.x = p.x;
    this.y = p.y;
  }

  readFromDataset(json) {
    json.hasOwnProperty('x') && (this.x = json.x);
    json.hasOwnProperty('y') && (this.y = json.y);
    this.status = POINT_STATUS.INACTIVE;
  }

  toDataset() {
    return {
      'x': this.x,
      'y': this.y
    }
  }

}