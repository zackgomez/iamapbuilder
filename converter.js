/* @flow */
const _ = require('lodash');

const EdgeTypeToBorderStyle = {
  Nothing: null,
  Wall: {
    style: 'SOLID_THICK',
    width: 3,
    color: {},
  },
  CellBoundary: {
    style: 'DOTTED',
    width: 1,
    color: {
      red: 0.49803922,
      green: 0.49803922,
      blue: 0.49803922,
    },
  },
  TileBoundary: {
    style: 'SOLID',
    width: 1,
    color: {},
  },
  Blocking: {
    style: 'SOLID_MEDIUM',
    width: 2,
    color: {
      red: 1,
    },
  },
  Impassible: {
    style: 'DASHED',
    width: 2,
    color: {
      red: 1,
    },
  },
  Difficult: {
    style: 'SOLID_MEDIUM',
    width: 2,
    color: {
      red: 0.30980393,
      green: 0.5058824,
      blue: 0.7411765,
    },
  },
};

const InBoundsCellBGColor = {
  red: 0.91764706,
  green: 0.94509804,
  blue: 0.8666667,
};
const DifficultCellBGColor = {
  red: 0.85882354,
  green: 0.8980392,
  blue: 0.94509804,
};

function getMapRange(map) {
  const endCol = String.fromCharCode('B'.charCodeAt(0) + map.cols - 1);
  const endRow = 2 + map.rows - 1;
  return `B2:${endCol}${endRow}`;
}

const EDGE_ITERATOR = [
  {dy: 0, dx: 0, dir: 'v', name: 'left'},
  {dy: 0, dx: 0, dir: 'h', name: 'top'},
  {dy: 0, dx: 1, dir: 'v', name: 'right'},
  {dy: 1, dx: 0, dir: 'h', name: 'bottom'},
];

function getCell(map, x, y) {
  const rowValues = map.cells[y];
  if (!rowValues) {
    return null;
  }
  return rowValues[x];
}

function getEdge(map, x, y, dir) {
  const source = dir === 'v' ? map.vertical_edges : map.horizontal_edges;
  if (source[y]) {
    return source[y][x];
  }
  return null;
}

const USER_ENTERED_FORMAT_CENTERED = {
  horizontalAlignment: 'CENTER',
  verticalAlignment: 'MIDDLE',
};
const USER_ENTERED_FORMAT_TEXT_CELL = {
  verticalAlignment: 'MIDDLE',
  textFormat: {
    fontFamily: 'Calibri',
    fontSize: 11,
    bold: true,
  },
  /*
  textFormatRuns: [
  {
    format: {},
  },
  {
    startIndex: 9,
    format: {
      foregroundColor: {},
      // nobold
    },
  ]
  */
};

function renderTextCell(map: any, mapRenderInfo: MapRenderInfo, row: number, col: number) {
  let text = null;
  if (row === mapRenderInfo.maxRow + 3 && col === 0) {
    text = `Location: ${map.briefingLocation}`;
  } else if (row === mapRenderInfo.maxRow + 2 && col === 0) {
    text = `Type: ${map.mapType}`;
  } else {
    return null;
  }

  return {
    userEnteredValue: {
      stringValue: text,
    },
    userEnteredFormat: {
      ...USER_ENTERED_FORMAT_TEXT_CELL,
    },
  };
}

function renderCell(map: any, mapRenderInfo: MapRenderInfo, row: number, col: number) {
  // render map info?
  const textCell = renderTextCell(map, mapRenderInfo, row, col);
  if (textCell) {
    return textCell;
  }

  let userEnteredValue = {};
  let userEnteredFormat = {};

  let cell = getCell(map, col, row);
  if (cell) {
    if (cell.inBounds) {
      userEnteredFormat.backgroundColor = InBoundsCellBGColor;
    }
    if (cell.difficultTerrain) {
      userEnteredFormat.backgroundColor = DifficultCellBGColor;
    }

    if (cell.startingPoint) {
      // TODO
    }
    if (cell.tileNumber) {
      userEnteredValue.stringValue = cell.tileNumber;
      userEnteredFormat = {...userEnteredFormat, ...USER_ENTERED_FORMAT_CENTERED};
      //userEnteredFormat.horizontalAlignment = 'CENTER';
      //userEnteredFormat.verticalAlignment = 'MIDDLE';
    }
  }

  let renderedBorders = {};
  EDGE_ITERATOR.forEach(desc => {
    const edge = getEdge(map, col + desc.dx, row + desc.dy, desc.dir);
    if (!edge) {
      return;
    }
    const borderStyle = EdgeTypeToBorderStyle[edge];
    if (!borderStyle) {
      return;
    }
    renderedBorders[desc.name] = borderStyle;
  });

  if (!_.isEmpty(renderedBorders)) {
    userEnteredFormat.borders = renderedBorders;
  }

  const ret = {};
  if (!_.isEmpty(userEnteredValue)) {
    ret.userEnteredValue = userEnteredValue;
  }
  if (!_.isEmpty(userEnteredFormat)) {
    ret.userEnteredFormat = userEnteredFormat;
  }

  return ret;
}

type MapRenderInfo = {
  maxRow: number;
};

function computeMaxRow(map: any): number {
  for (let r = map.rows - 1; r > 0; r--) {
    let c = 0;
    for (; c < map.cols; c++) {
      const cell = getCell(map, c, r);
      if (cell && cell.inBounds) {
        break;
      }
    }
    if (c !== map.cols) {
      return r;
    }
  }
  return 0;
}

function makeUpdateCellsRequest(sheetId: string, map: any) {
  const mapRenderInfo : MapRenderInfo = {
    maxRow: computeMaxRow(map),
  };

  const rows = [];
  // HACK:
  for (let r = 0; r < map.rows; r++) {
    const values = [];
    for (let c = 0; c < map.cols && c < 25; c++) {
      values.push(renderCell(map, mapRenderInfo, r, c));
    }
    rows.push({values});
  }

  return {
    start: {
      sheetId,
      rowIndex: 1,
      columnIndex: 1,
    },
    rows,
    fields: 'userEnteredValue,userEnteredFormat',
  };
}

module.exports = {
  makeUpdateCellsRequest,
};
