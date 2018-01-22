/* @flow */
import _ from 'lodash';
import Board from './board';

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
};

function renderTileListItem(tile: string, count: number) {
  if (count < 2) {
    return tile;
  }
  return `${tile.trim()}(${count})`;
}

function renderTileListValue(tileList: any): string {
  const reduced = [];
  let lastTile = null;
  let count = 0;
  tileList.tiles.forEach(tile => {
    if (tile !== lastTile) {
      if (lastTile !== null) {
        reduced.push(renderTileListItem(lastTile, count));
      }
      lastTile = tile;
      count = 1;
    } else {
      count++;
    }
  });
  if (lastTile) {
    reduced.push(renderTileListItem(lastTile, count));
  }

  return reduced.join(', ');
}

function renderLabelCell(title: string, value: string, valueColor: ?any): any {
  const text = `${title}: ${value}`;
  return {
    userEnteredValue: {
      stringValue: text,
    },
    userEnteredFormat: {
      ...USER_ENTERED_FORMAT_TEXT_CELL,
    },
    textFormatRuns: [
      {
        startIndex: title.length + 2,
        format: {
          foregroundColor: valueColor,
          fontFamily: 'Calibri',
          fontSize: 11,
          bold: false,
        },
      },
    ],
  };
}

function renderTextCell(map: any, mapRenderInfo: MapRenderInfo, row: number, col: number) {
  if (col !== 0) {
    return;
  }

  let title = '';
  let value = '';
  let color = null;

  const TILE_LIST_START_ROW = mapRenderInfo.maxRow + 2;
  const MISSION_INFO_START_ROW = TILE_LIST_START_ROW + map.tileLists.length + 1;

  if (col === 0 && row >= TILE_LIST_START_ROW && row < TILE_LIST_START_ROW + map.tileLists.length) {
    const tileList = map.tileLists[row - TILE_LIST_START_ROW];
    title = tileList.title;
    value = renderTileListValue(tileList);
  } else if (row === MISSION_INFO_START_ROW) {
    title = 'Type';
    value = map.mapType;
    color = computeMissionColor(map);
  } else if (row === MISSION_INFO_START_ROW + 1) {
    title = 'Location';
    value = map.briefingLocation;
  } else {
    return null;
  }

  const v = renderLabelCell(title, value, color);
  return v;
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
  maxCol: number;
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
function computeMaxCol(map: any): number {
  for (let c = map.cols - 1; c > 0; c--) {
    let r = 0;
    for (; r < map.rows; r++) {
      const cell = getCell(map, c, r);
      if (cell && cell.inBounds) {
        break;
      }
    }
    if (r !== map.rows) {
      return c;
    }
  }
  return 0;
}

function computeMissionColor(map: any): any {
  const type = map.mapType.toLowerCase();
  if (type.startsWith('red')) {
    return {
      red: 1
    };
  } else if (type.startsWith('gray')) {
    return {
      red: 127 / 255,
      green: 127 / 255,
      blue: 127 / 255,
    };
  } else if (type.startsWith('green')) {
    return {
      red: 0 / 255,
      green: 176 / 255,
      blue: 80 / 255,
    };
  } else if (type.startsWith('agenda')) {
    return {
      red: 31 / 255,
      green: 73 / 255,
      blue: 125 / 255,
    };
  }
  return null;
}

export function makeUpdateCellsRequest(sheetId: number, map: any) {
  const mapRenderInfo : MapRenderInfo = {
    maxRow: computeMaxRow(map),
    maxCol: computeMaxCol(map),
  };

  const rowCount = getSheetHeight(map);
  const colCount = getSheetWidth(map);

  const rows = [];
  // HACK:
  for (let r = 0; r < rowCount - 1; r++) {
    const values = [];
    for (let c = 0; c < colCount - 1 ; c++) {
      values.push(renderCell(map, mapRenderInfo, r, c));
    }
    rows.push({values});
  }

  return {
    updateCells: {
      start: {
        sheetId,
        rowIndex: 1,
        columnIndex: 1,
      },
      rows,
      fields: 'userEnteredValue,userEnteredFormat,textFormatRuns',
    },
  };
}

function getSheetHeight(map: any): number {
  const maxRow = computeMaxRow(map);
  return 1 + maxRow + 1 + map.tileLists.length + 1 + 2 + 1;
}
function getSheetWidth(map: any): number {
  return Math.max(2 + computeMaxCol(map), 26);
}

function getSheetProperties(sheetId: ?number, map: any): any {
  // TODO also compute max col here
  return {
    sheetId,
    title: map.name,
    tabColor: computeMissionColor(map),
    gridProperties: {
      rowCount: getSheetHeight(map),
      columnCount: getSheetWidth(map),
    },
  };
}

export function makeUpdateSheetPropertiesRequest(sheetId: number, map: any) {
  return {
    updateSheetProperties: {
      properties: getSheetProperties(sheetId, map),
      fields: 'title,tabColor,gridProperties',
    }
  };
}

function makeUpdateDimensionPropertiesRequest(sheetId: number, dimension, pixelSize) {
  return {
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension,
      },
      properties: {
        pixelSize,
      },
      fields: 'pixelSize',
    },
  };
}

export function makeUpdateDimensionPropertiesRequests(sheetId: number): Array<any> {
  return [
    makeUpdateDimensionPropertiesRequest(
      sheetId,
      'COLUMNS',
      29,
    ),
    makeUpdateDimensionPropertiesRequest(
      sheetId,
      'ROWS',
      30,
    ),
  ];
}

export function makeCreateSheetRequest(map: any, sheetId: ?number): any {
  return {
    addSheet: {
      properties: getSheetProperties(sheetId, map),
    },
  };
}
