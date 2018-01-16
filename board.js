/* @flow */

import _ from 'lodash';
import invariant from 'invariant';
import nullthrows from 'nullthrows';

export type Cell = {
  inBounds?: boolean,
  startingPoint?: boolean,
  tileNumber?: string,
  difficultTerrain?: boolean,
};

export type Edge = 'Nothing' | 'Wall' | 'TileBoundary' | 'CellBoundary' | 'Blocking' | 'Impassible' | 'Difficult';
export type EdgeDirection = 'Horizontal' | 'Vertical';

function defaultCell(): Cell {
  return {};
}

function defaultEdge(): Edge {
  return 'Nothing';
}

export default class Board {
  static emptyBoard(width: number, height: number): Board {
    return new Board(width, height);
  }

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.cellRows = {};
    this.verticalEdgeRows = {};
    this.horizontalEdgeRows = {};
  }

  getWidth(): number {
    return this.width;
  }
  getHeight(): number {
    return this.height;
  }

  isValidCell(x: number, y: number): boolean {
    if (x < 0 || x >= this.width) {
      return false;
    }
    if (y < 0 || y >= this.height) {
      return false;
    }

    return true;
  }
  isValidEdge(x: number, y: number, dir: EdgeDirection): boolean {
    if (x < 0 || x > this.width || y < 0 || y > this.height) {
      return false;
    }
    if (x === this.width && dir === 'Horizontal') {
      return false;
    }
    if (y === this.height && dir === 'Vertical') {
      return false;
    }
    return true;
  }

  getCell(x: number, y: number): Cell {
    const cols = this.cellRows[y];
    if (!cols) {
      return defaultCell();
    }
    if (!cols[x]) {
      return defaultCell();
    }
    return cols[x];
  }

  getEdge(x: number, y: number, dir: EdgeDirection): Edge {
    const source = this.getEdgeRowsForDirection_(dir);
    const cols = source[y];
    if (!cols) {
      return defaultEdge();
    }
    if (!cols[x]) {
      return defaultEdge();
    }
    return cols[x];
  }

  setCell(x: number, y: number, cell: Cell): void {
    invariant(this.isValidCell(x, y), 'Invalid cell coordinates %s, %s', x, y);

    if (!this.cellRows[y]) {
      this.cellRows[y] = {};
    }
    this.cellRows[y][x] = cell;
  }

  setEdge(x: number, y: number, dir: EdgeDirection, edge: Edge): void {
    invariant(
      this.isValidEdge(x, y, dir),
      'Invalid edge coordinates %s, %s, %s',
      x,
      y,
      dir,
    );
    const source = this.getEdgeRowsForDirection_(dir);
    console.log('setEdge', x, y, dir, edge, source);

    if (!source[y]) {
      source[y] = {};
    }
    source[y][x] = edge;
  }

  getEdgeRowsForDirection_(
    dir: EdgeDirection,
  ): {[row_index: number]: {[col_index: number]: Edge}} {
    return dir === 'Horizontal' ? this.horizontalEdgeRows : this.verticalEdgeRows;
  }

  width: number;
  height: number;
  cellRows: {[row_index: number]: {[col_index: number]: Cell}};
  verticalEdgeRows: {[row_index: number]: {[col_index: number]: Edge}};
  horizontalEdgeRows: {[row_index: number]: {[col_index: number]: Edge}};
}
