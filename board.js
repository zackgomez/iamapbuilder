/* @flow */

import _ from 'lodash';
import invariant from 'invariant';
import nullthrows from 'nullthrows';

export type Cell = {
  inBounds?: boolean,
  startingPoint?: boolean,
  tileNumber?: ?string,
  difficultTerrain?: boolean,
};

export type Edge =
  | 'Nothing'
  | 'Wall'
  | 'TileBoundary'
  | 'CellBoundary'
  | 'Blocking'
  | 'Impassible'
  | 'Difficult';
export type EdgeDirection = 'Horizontal' | 'Vertical';

export type TileList = {
  title: string,
  tiles: Array<string>,
};

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

  constructor(
    width: number,
    height: number,
    name: string = '',
    briefingLocation: string = '',
    mapType: string = '',
  ) {
    this.name = name || 'Unnamed Map';
    this.briefingLocation = briefingLocation || 'Unset Location';
    this.mapType = mapType || 'Unset Type';
    this.width = width;
    this.height = height;

    this.cellRows = {};
    this.verticalEdgeRows = {};
    this.horizontalEdgeRows = {};
    this.tileLists = [];
  }

  getWidth(): number {
    return this.width;
  }
  getHeight(): number {
    return this.height;
  }
  getName(): string {
    return this.name;
  }
  getBriefingLocation(): string {
    return this.briefingLocation;
  }
  getMapType(): string {
    return this.mapType;
  }
  getTileLists(): Array<TileList> {
    return this.tileLists;
  }

  setName(name: string): void {
    this.name = name;
  }
  setBriefingLocation(briefingLocation: string): void {
    this.briefingLocation = briefingLocation;
  }
  setMapType(mapType: string): void {
    this.mapType = mapType;
  }

  addTileList(tileList: TileList): void {
    this.tileLists.push(tileList);
  }
  removeTileList(index: number): void {
    if (this.tileLists.length > index) {
      this.tileLists.splice(index, 1);
    }
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

    if (!source[y]) {
      source[y] = {};
    }
    if (edge === defaultEdge()) {
      delete source[y][x];
    } else {
      source[y][x] = edge;
    }
  }

  getEdgeRowsForDirection_(
    dir: EdgeDirection,
  ): {[row_index: number]: {[col_index: number]: Edge}} {
    return dir === 'Horizontal' ? this.horizontalEdgeRows : this.verticalEdgeRows;
  }

  resolveBoundaryEdge(cell: Cell): Edge {
    if (cell.inBounds) {
      return 'Wall';
    }
    return 'Nothing';
  }
  resolveEdge(a: Cell, b: Cell, existingEdge: Edge): Edge {
    if (!a.inBounds && !b.inBounds) {
      return 'Nothing';
    }
    if (a.inBounds != b.inBounds) {
      return 'Wall';
    }

    // Both inBounds

    const USER_DEFINED_EDGES: Array<Edge> = [
      'TileBoundary',
      'Impassible',
      'Wall',
      'Blocking',
    ];
    if (USER_DEFINED_EDGES.indexOf(existingEdge) != -1) {
      return existingEdge;
    }

    if (a.difficultTerrain != b.difficultTerrain) {
      return 'Difficult';
    }

    return 'CellBoundary';
  }

  applyEdgeRules(): void {
    // XXX: THIS CODE DOES NOT HANDLE RIGHT/BOTTOM boundary
    for (let x = 0; x < this.getWidth(); x++) {
      for (let y = 0; y < this.getHeight(); y++) {
        const bottomRight = this.getCell(x, y);
        if (x === 0) {
          this.setEdge(x, y, 'Vertical', this.resolveBoundaryEdge(bottomRight));
        } else {
          this.setEdge(
            x,
            y,
            'Vertical',
            this.resolveEdge(
              bottomRight,
              this.getCell(x - 1, y),
              this.getEdge(x, y, 'Vertical'),
            ),
          );
        }
        if (y === 0) {
          this.setEdge(x, y, 'Horizontal', this.resolveBoundaryEdge(bottomRight));
        } else {
          this.setEdge(
            x,
            y,
            'Horizontal',
            this.resolveEdge(
              bottomRight,
              this.getCell(x, y - 1),
              this.getEdge(x, y, 'Horizontal'),
            ),
          );
        }
      }
    }
  }

  // Compact internal storage, removing redundant/default values
  compact(): void {}

  serialize(): string {
    return JSON.stringify({
      rows: this.height,
      cols: this.width,
      cells: this.cellRows,
      horizontal_edges: this.horizontalEdgeRows,
      vertical_edges: this.verticalEdgeRows,
      name: this.name,
      briefingLocation: this.briefingLocation,
      mapType: this.mapType,
      tileLists: this.tileLists,
    });
  }
  static fromSerialized(serialized: string): Board {
    const json = JSON.parse(serialized);
    const board = new Board(json.cols, json.rows, json.name, json.briefingLocation, json.mapType);
    board.cellRows = json.cells || {};
    board.verticalEdgeRows = json.vertical_edges || {};
    board.horizontalEdgeRows = json.horizontal_edges || {};
    board.tileLists = json.tileLists || [];

    return board;
  }
  static defaultBoard(): Board {
    return new Board(26, 50, '<unset>', '<unset>', '<unset>');
  }

  name: string;
  briefingLocation: string;
  mapType: string;
  tileLists: Array<TileList>;

  width: number;
  height: number;
  cellRows: {[row_index: number]: {[col_index: number]: Cell}};
  verticalEdgeRows: {[row_index: number]: {[col_index: number]: Edge}};
  horizontalEdgeRows: {[row_index: number]: {[col_index: number]: Edge}};
}
