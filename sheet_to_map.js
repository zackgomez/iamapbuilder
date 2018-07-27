/* @flow */

import fs from 'mz/fs';
import _ from 'lodash';
import invariant from 'invariant';

import Board from './board';
import type {Cell, Edge, EdgeDirection} from './board';

type Color = {
  red?: number,
  blue?: number,
  green?: number,
};

type BorderStyle = string;
type Border = {
  style?: BorderStyle,
  width?: number,
  color: Color,
};

type SheetCell = {
  userEnteredFormat?: {
    backgroundColor?: Color,
    borders?: {
      top: Border,
      bottom: Border,
      left: Border,
      right: Border,
    },
    horizontalAlignment?: string,
    verticalAlignment?: string,
    wrapStrategy?: string,
  },
  userEnteredValue?: {
    stringValue?: string,
  },
};

type Row = {
  values: Array<SheetCell>,
};

function isMapCell(cell: SheetCell): boolean {
  if (cell.userEnteredFormat && cell.userEnteredFormat.backgroundColor) {
    const {backgroundColor} = cell.userEnteredFormat;
    if (
      backgroundColor.red &&
      backgroundColor.red !== 1 &&
      backgroundColor.green &&
      backgroundColor.green !== 1 &&
      backgroundColor.blue &&
      backgroundColor.blue !== 1
    ) {
      return true;
    }
  }
  return false;
}

function convertCell(cell: SheetCell): ?Cell {
  if (!cell.userEnteredFormat || !cell.userEnteredFormat.backgroundColor) {
    return null;
  }
  const {backgroundColor} = cell.userEnteredFormat;
  const text = (cell.userEnteredValue && cell.userEnteredValue.stringValue) || null;

  const convertedCell: Cell = {};

  let matches = text && text.match(/(\d\d[AB])/);
  if (matches && matches.length === 2) {
    convertedCell.tileNumber = matches[1];
  } else if (text === '!') {
    convertedCell.startingPoint = true;
  }

  let {red, green, blue} = backgroundColor;
  red = red || 0;
  green = green || 0;
  blue = blue || 0;

  if (red !== 1 && green !== 1 && blue !== 1) {
    convertedCell.inBounds = true;

    if (blue > red && blue > green && blue > 0.9) {
      convertedCell.difficultTerrain = true;
    }

    return convertedCell;
  }

  return null;
}

type ExtractedEdge = {|
  x: number,
  y: number,
  edge: Edge,
  dir: EdgeDirection,
|};

function convertBorderToEdge(border: Border): Edge {
  const color: Color = border.color || {};
  if (border.style === 'SOLID_THICK') {
    return 'Wall';
  } else if (border.style === 'SOLID_MEDIUM') {
    if (color.red && color.red > 0.9) {
      return 'Blocking';
    }
    if (color.blue && color.blue > 0.7) {
      return 'Difficult';
    }
  } else if (border.style === 'SOLID') {
    if (!color.blue && !color.red && !color.green) {
      return 'TileBoundary';
    }
  } else if (border.style === 'DASHED') {
    if (color.red && color.red > 0.9) {
      return 'Impassible';
    }
  }

  return 'Nothing';
}

function extractEdges(cell: SheetCell, x: number, y: number): Array<ExtractedEdge> {
  const borders = cell.userEnteredFormat && cell.userEnteredFormat.borders;
  if (!borders) {
    return [];
  }

  const edges = [];
  if (borders.top) {
    const edge = convertBorderToEdge(borders.top);
    edges.push({
      edge,
      dir: 'Horizontal',
      x,
      y,
    });
  }
  if (borders.bottom) {
    const edge = convertBorderToEdge(borders.bottom);
    edges.push({
      edge,
      dir: 'Horizontal',
      x,
      y: y + 1,
    });
  }
  if (borders.left) {
    const edge = convertBorderToEdge(borders.left);
    edges.push({
      edge,
      dir: 'Vertical',
      x,
      y,
    });
  }
  if (borders.right) {
    const edge = convertBorderToEdge(borders.right);
    edges.push({
      edge,
      dir: 'Vertical',
      x: x + 1,
      y,
    });
  }

  return edges;
}

function parseTileString(s: string): Array<string> {
  const parts = s
    .trim()
    .replace(/,/g, '')
    .replace(/ \(/g, '(')
    .split(' ');
  const explodedParts = [];
  parts.forEach(part => {
    const matches = part.match(/(\d\d[AB])\((\d)\)/);
    if (matches && matches.length === 3) {
      const tile = matches[1];
      let count = matches[2].charCodeAt(0) - '0'.charCodeAt(0);
      while (count-- > 0) {
        explodedParts.push(tile);
      }
    } else {
      invariant(part.match(/\d\d[AB]/), 'invalid tile %s', part);
      explodedParts.push(part);
    }
  });
  return explodedParts;
}

function enumerateCells(
  rows: Array<Row>,
  iterator: (cell: SheetCell, x: number, y: number) => void,
) {
  rows.forEach((row, y) => {
    if (row.values) {
      row.values.forEach((cell, x) => {
        iterator(cell, x, y);
      });
    }
  });
}

export function convertSheet(sheet: any): Board {
  const title = sheet.properties.title;
  const sheetRows = sheet.properties.gridProperties.rowCount;
  const sheetCols = sheet.properties.gridProperties.columnCount;

  const rows: Array<Row> = sheet.data[0].rowData;
  invariant(
    rows.length <= sheetRows,
    'row count mismatch %s vs %s',
    rows.length,
    sheetRows,
  );

  let location = '';
  let type = '';
  let tilePairs: Array<[string, string]> = [];

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = 0;
  let y1 = 0;
  // compute map size
  enumerateCells(rows, (cell, x, y) => {
    if (isMapCell(cell)) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }

    if (cell.userEnteredValue && cell.userEnteredValue.stringValue) {
      const text = cell.userEnteredValue.stringValue;

      let matches = text.match(/Location:\s+(.*)/);
      if (matches && matches.length === 2) {
        location = matches[1];
      }
      matches = text.match(/Type:\s+(.*)/);
      if (matches && matches.length === 2) {
        type = matches[1];
      }

      matches = text.match(/^([^:]*):\s*((\d\d[AB])+.*)/);
      if (matches && matches.length === 4) {
        tilePairs.push([matches[1], matches[2]]);
      }
    }
  });

  console.log(`Name: ${title}`);
  console.log(`Location: ${location}`);
  console.log(`Type: ${type}`);

  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  console.log(`Board starts at (${x0}, ${y0}) with size ${width} x ${height}`);

  const board = new Board(width, height, title, location, type);

  tilePairs.forEach(([title, s]) => {
    board.addTileList({
      title,
      tiles: parseTileString(s),
    });
  });

  enumerateCells(rows, (cell, sheetX, sheetY) => {
    const x = sheetX - x0;
    const y = sheetY - y0;

    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    const edges = extractEdges(cell, x, y);

    edges.forEach(({x, y, edge, dir}) => {
      if (edge === 'Nothing') {
        return;
      }
      const existing = board.getEdge(x, y, dir);
      if (edge === existing) {
        return;
      }
      if (existing !== 'Nothing' && existing !== 'TileBoundary') {
        //console.log('not overwriting', x, y, dir, existing, 'with new edge', edge);
        return;
      }
      board.setEdge(x, y, dir, edge);
    });

    const convertedCell = convertCell(cell);
    if (convertedCell) {
      board.setCell(x, y, convertedCell);
    }
  });

  board.applyEdgeRules();

  return board;
}

// $FlowFixMe
if (require.main === module) {
  const argv = process.argv;
  const filename = argv.length > 2 ? argv[2] : 'HomeFront.json';
  const data = fs.readFileSync(filename);
  const spreadsheet = JSON.parse(data);
  const sheet = spreadsheet.sheets[0];

  const board = convertSheet(sheet);
  fs.writeFileSync('derp.json', JSON.stringify(JSON.parse(board.serialize()), null, 2));
}
