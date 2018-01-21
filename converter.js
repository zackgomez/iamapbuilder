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

function renderLabelCell(title: string, value: string): any {
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
          foregroundColor: {},
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

  const TILE_LIST_START_ROW = mapRenderInfo.maxRow + 2;
  const MISSION_INFO_START_ROW = TILE_LIST_START_ROW + map.tileLists.length + 1;

  if (col === 0 && row >= TILE_LIST_START_ROW && row < TILE_LIST_START_ROW + map.tileLists.length) {
    const tileList = map.tileLists[row - TILE_LIST_START_ROW];
    title = tileList.title;
    value = renderTileListValue(tileList);
  } else if (row === MISSION_INFO_START_ROW) {
    title = 'Type';
    value = map.mapType;
  } else if (row === MISSION_INFO_START_ROW + 1) {
    title = 'Location';
    value = map.briefingLocation;
  } else {
    return null;
  }

  const v = renderLabelCell(title, value);
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

function computeMissionColor(map: any): any {
  const type = map.mapType.toLowerCase();
  if (type.startsWith('red')) {
    return { red: 1 };
  } else if (type.startsWith('gray')) {
    return {
      red: 127,
      green: 127,
      blue: 127,
    };
  } else if (type.startsWith('green')) {
    return {
      green: 176,
      blue: 80,
    };
  } else if (type.startsWith('agenda')) {
    return {
      red: 31,
      green: 73,
      blue: 125,
    };
  }
  return null;
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
    fields: 'userEnteredValue,userEnteredFormat,textFormatRuns',
  };
}

function makeUpdateSpreadsheetRequest(sheetId: string, map: any) {
  return {
    updateSheetProperties: {
      properties: {
        sheetId,
        title: map.name,
        tabColor: computeMissionColor(map),
      },
      fields: 'title,tabColor',
    }
  };
}

module.exports = {
  makeUpdateCellsRequest,
  makeUpdateSpreadsheetRequest,
};
