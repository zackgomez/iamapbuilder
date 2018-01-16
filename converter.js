const fs = require('mz/fs');
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
    width: 1,
    color: {
      red: 1
    }
  },
  Difficult: {
    style: 'SOLID_MEDIUM',
    width: 2,
    color: {
      red: 0.30980393,
      green: 0.5058824,
      blue: 0.7411765
    }
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
  blue: 0.94509804
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

function borderStyleForEdge(edge) {
  if (!edge) {
    return null;
  }
  if (edge === 'Wall') {
    return WallBorderStyle;
  }
  if (edge === 'TileBoundary') {
  }
  if (edge === 'CellBoundary') {
    return CellBoundaryBorderStyle;
  }
  if (edge === 'Blocking') {
  }
  if (edge === 'Impassible') {
  }
  if (edge === 'Difficult') {
  }
}

function renderCell(map, row, col) {
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
    }
  }

  let renderedBorders = {};
  for (const i in EDGE_ITERATOR) {
    const desc = EDGE_ITERATOR[i];
    const edge = getEdge(map, col + desc.dx, row + desc.dy, desc.dir);
    if (!edge) {
      continue;
    }
    const borderStyle = EdgeTypeToBorderStyle[edge];
    if (!borderStyle) {
      continue;
    }
    renderedBorders[desc.name] = borderStyle;
  }

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

function makeUpdateCellsRequest(sheetId, map) {
  const rows = [];
  // HACK:
  for (let r = 0; r < map.rows; r++) {
    const values = [];
    for (let c = 0; c < map.cols && c < 25; c++) {
      values.push(renderCell(map, r, c));
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
