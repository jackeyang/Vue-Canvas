/**
 * 小圆点半径
 * @type {number}
 */
export const RADIUS = 3;


/**
 * 是否封闭图形的临界值
 * @type {number}
 */
export const LIMIT = 25;


/**
 * 激活图形的临界值
 * @type {number}
 */
export const ACTIVE_LIMIT = 5;


/**
 * 点的状态
 */
export const POINT_STATUS = {
  INACTIVE: 1,       //普通状态
  ACTIVE: 2,         //激活状态
};

export const POINT_COLOR = {
  NORMAL: 'white',
  ACTIVE: 'red'
};

/**
 * 多边形状态
 */
export const POLYGON_STATUS = {
  DRAWING: 1,       //绘制状态
  COMPLETE: 2,      //绘制完成状态
  DELETE: 3,        //删除状态
};

/**
 * 多变形颜色值,分为常态和激活态
 */
export const POLYGON_LINE_COLOR = {
  normal: {
    NORMAL: '#aaaaaa',
    ACTIVE: '#dddddd'
  },
  white: {
    NORMAL: '#aaaaaa',
    ACTIVE: '#dddddd'
  },
  red: {
    NORMAL: '#fc826b',
    ACTIVE: '#dddddd'
  },
  green: {
    NORMAL: '#49fbd5',
    ACTIVE: '#dddddd'
  },
  blue: {
    NORMAL: '#459fee',
    ACTIVE: '#dddddd'
  },
  purple: {
    NORMAL: '#9471eb',
    ACTIVE: '#dddddd'
  }
};

export const FILL_STYLE = {
  GREY: '#aaaaaa',
  BLACK: '#000000'
};

export const TEXT_STYLE = {
  WHITE: '#FFFFFF',
}