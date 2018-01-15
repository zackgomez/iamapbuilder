/* @flow */

import _ from 'lodash';
import invariant from 'invariant';
import nullthrows from 'nullthrows';
import {gridCastRay} from './RayCast';

export type Cell = 'Empty' | 'Blocking' | 'OutOfBounds';
export type Corner = 'UpLeft' | 'UpRight' | 'DownLeft' | 'DownRight';
export type Edge = 'Clear' | 'Blocking' | 'Impassable' | 'Wall';
export type EdgeDirection = 'Down' | 'Right';
export type Direction = 'Right' | 'DownRight' | 'Down' | 'DownLeft'
                         | 'Left' | 'UpLeft' | 'Up' | 'UpRight';
// corners and directions ordered clockwise
export const CORNERS = ['UpLeft', 'UpRight', 'DownRight', 'DownLeft'];
export const DIRECTIONS = ['Right', 'DownRight', 'Down', 'DownLeft',
                           'Left', 'UpLeft', 'Up', 'UpRight'];

export type Point = {
  x: number,
  y: number,
};
export type EdgePoint = {
  x: number,
  y: number,
  dir: EdgeDirection,
};
export type LineOfSightResult = {
  hasLineOfSight: bool,
  sourceCorner: ?Corner,
  targetCorners: ?[Corner, Corner],
};
export type RayCastPoint = {
  x: number,
  y: number,
  corner: Corner,
};
export type RayCheckResult = {
  blocked: bool,
};

export type LineOfSightOptions = {
  ignoreFigures: bool,
}

export function defaultLineOfSightOptions(): LineOfSightOptions {
  return {
    ignoreFigures: false,
  };
}

export function cellToPoint(
  cellPoint: Point,
  corner: Corner,
): Point {
  return {
    x: cellPoint.x + ((corner === 'UpLeft' || corner === 'DownLeft') ? 0 : 1),
    y: cellPoint.y + ((corner === 'UpLeft' || corner === 'UpRight') ? 0 : 1),
  };
}

function pointToEdgePoint(
  point: Point,
  dir: Direction,
): EdgePoint {
  if (dir === 'Right' || dir === 'Down') {
    return {x: point.x, y: point.y, dir: dir};
  }
  if (dir === 'Left') {
    return {x: point.x - 1, y: point.y, dir: 'Right'};
  }
  if (dir === 'Up') {
    return {x: point.x, y: point.y - 1, dir: 'Down'};
  }
  throw new Error('not an edge direction');
}

function distSquared(
  p0: Point,
  p1: Point,
): number {
  let dx = p1.x - p0.x;
  let dy = p1.y - p0.y;
  return (dx * dx + dy * dy);
}

function oppositeDirection(dir: Direction): Direction {
  let index = 0;
  for (let i = 0; i < DIRECTIONS.length; i++) {
    if (DIRECTIONS[i] === dir) {
      index = i;
      break;
    }
  }
  return DIRECTIONS[(index + 4) % 8];
}

/* check ray p0->p1 versus ray p0->p2 */
function areRaysParallel(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): bool {
  let dx1 = x1 - x0;
  let dy1 = y1 - y0;
  let dx2 = x2 - x0;
  let dy2 = y2 - y0;
  if ((dx1 === 0 && dy1 === 0) || (dx2 === 0 && dy2 === 0)) {
    return true;
  }
  if (dx1 * dy2 === dx2 * dy1) {
    return true;
  }
  return false;
}

function directionFromRay(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): ?Direction {
  let dx = x1 - x0;
  let dy = y1 - y0;
  if (dx > 0 && dy === 0) {
    return 'Right';
  }
  else if (dx > 0 && dy > 0) {
    return 'DownRight';
  }
  else if (dx === 0 && dy > 0) {
    return 'Down';
  }
  else if (dx < 0 && dy > 0) {
    return 'DownLeft';
  }
  else if (dx < 0 && dy === 0) {
    return 'Left';
  }
  else if (dx < 0 && dy < 0) {
    return 'UpLeft';
  }
  else if (dx === 0 && dy < 0) {
    return 'Up';
  }
  else if (dx > 0 && dy < 0) {
    return 'UpRight';
  }
  // direction is not defined if start and end points are equal
  return;
}

export default class Board {
  width: number;
  height: number;
  board: Array<Cell>;
  rightEdges: Array<Edge>;
  downEdges: Array<Edge>;

  constructor(
    width: number,
    height: number,
    board: Array<Cell>,
    rightEdges: Array<Edge>,
    downEdges: Array<Edge>,
  ) {
    this.height = height;
    this.width = width;
    this.board = board;
    this.rightEdges = rightEdges;
    this.downEdges = downEdges;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getCell(x: number, y: number): Cell {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return 'OutOfBounds';
    }
    return this.board[x + y * this.width];
  }

  isValidCell(x: number, y: number): bool {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return true;
  }
  isValidEdge(x: number, y: number, dir: EdgeDirection): bool {
    if (x < 0 || x > this.width || y < 0 || y > this.height) {
      return false;
    }
    if (x === this.width && dir === 'Right') {
      return false;
    }
    if (y === this.height && dir === 'Down') {
      return false;
    }
    return true;
  }
  setCell(x: number, y: number, cell: Cell): void {
    if (!this.isValidCell(x, y)) {
      throw new Error(`setCell: (${x}, ${y}) is out of bounds`);
    }
    this.board[x + y * this.width] = cell;
  }
  setEdge(x: number, y: number, dir: EdgeDirection, edge: Edge): void {
    if (!this.isValidEdge(x, y, dir)) {
      throw new Error(`setEdge: (${x}, ${y}, ${dir}) is out of bounds`);
    }
    const i = x + y * this.width;
    if (dir === 'Down') {
      this.downEdges[i] = edge;
    } else if (dir === 'Right') {
      this.rightEdges[i] = edge;
    }
  }
  clearBlocking(): void {
    this.board = this.board.map(cell => {
      return cell === 'Blocking' ? 'Empty' : cell;
    });
  }

  getEdge(x: number, y: number, dir: EdgeDirection): Edge {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return 'Wall';
    }
    if (x === 0 && dir === 'Down') {
      return 'Wall';
    }
    if (y === 0 && dir === 'Right') {
      return 'Wall';
    }
    if (dir === 'Down') {
      return this.downEdges[x + y * this.width];
    }
    if (dir === 'Right') {
      return this.rightEdges[x + y * this.width];
    }
    throw new Error('not a valid edge');
  }
  doesEdgeBlockLineOfSight(x: number, y: number, dir: EdgeDirection): boolean {
    const edge = this.getEdge(x, y, dir);
    return edge === 'Wall' || edge === 'Blocking';
  }

  /*
   * x and y are in square or cell space
   * (0, 0) to (width, height) exclusive
   */
  checkLineOfSight(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    optionsIn: ?LineOfSightOptions,
  ): LineOfSightResult {
    const options = optionsIn || defaultLineOfSightOptions();
    const results = CORNERS.map(sourceCorner => {
      return _.flatMap(CORNERS, targetCorner => {
        const {blocked} = this.checkRay(
          {x: sourceX, y: sourceY, corner: sourceCorner},
          {x: targetX, y: targetY, corner: targetCorner},
          options.ignoreFigures,
        );
        if (blocked) {
          return [];
        }
        return {sourceCorner, targetCorner};
      });
    });
    let hasLineOfSight = false;
    let sourceCorner = null;
    let targetCorners = null;
    let minDistSquaredSum = null;
    /*
     *  Loop over source corners and adjacent target corners. If the rays are
     *  non-parallel, it's a valid result. Return the result with the lowest
     *  sum of squared ray lengths.
     */
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let c0 = CORNERS[i];
        let c1 = CORNERS[j];
        let c2 = CORNERS[(j + 1) % 4];
        if (
          results[i].some(p =>
            (p.sourceCorner === c0 && p.targetCorner === c1)) &&
          results[i].some(p =>
            (p.sourceCorner === c0 && p.targetCorner === c2))
          ) {
          let p0 = cellToPoint({x: sourceX, y: sourceY}, c0);
          let p1 = cellToPoint({x: targetX, y: targetY}, c1);
          let p2 = cellToPoint({x: targetX, y: targetY}, c2);
          if (!areRaysParallel(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y)) {
            let distSquaredSum = distSquared(p0, p1) + distSquared(p0, p2);
            if (!minDistSquaredSum || distSquaredSum < minDistSquaredSum) {
              hasLineOfSight = true;
              minDistSquaredSum = distSquaredSum;
              sourceCorner = c0;
              targetCorners = [c1, c2];
            }
          }
        }
      }
    }
    return {
      hasLineOfSight,
      sourceCorner,
      targetCorners,
    };
  }

  checkPoint(
    point: Point,
    inDirection: Direction,
    outDirection: Direction,
  ): RayCheckResult {
    let inIndex = DIRECTIONS.indexOf(inDirection);
    let outIndex = DIRECTIONS.indexOf(outDirection);
    if (inIndex === outIndex) {
      return {blocked: false};
    }
    let blockedCW = false;
    let blockedCCW = false;
    let dist = (outIndex - inIndex) % 8;
    if (dist < 0) {
      dist += 8;
    }

    // Check clockwise (increasing directional index)
    for (let i = 1; i < dist; i++) {
      let checkIndex = (inIndex + i) % 8;
      if (checkIndex % 2 !== 0) {
        continue;
      }
      if (checkIndex < 0) {
        checkIndex += 8;
      }
      let checkEdgePoint = pointToEdgePoint(point, DIRECTIONS[checkIndex]);
      if (!checkEdgePoint) {
        throw new Error('edge not found');
      }
      if (this.doesEdgeBlockLineOfSight(
        checkEdgePoint.x,
        checkEdgePoint.y,
        checkEdgePoint.dir,
      )) {
        // console.log('checkPoint: CW blocked at idx = ' + checkIndex);
        // console.log(checkEdgePoint);
        blockedCW = true;
      }
    }

    dist = (inIndex - outIndex) % 8;
    if (dist < 0) {
      dist += 8;
    }
    // Check counterclockwise (decreasing directional index)
    for (let i = 1; i < dist; i++) {
      let checkIndex = (inIndex - i) % 8;
      if (checkIndex % 2 !== 0) {
        continue;
      }
      if (checkIndex < 0) {
        checkIndex += 8;
      }
      let checkEdgePoint = pointToEdgePoint(point, DIRECTIONS[checkIndex]);
      if (!checkEdgePoint) {
        throw new Error('edge not found');
      }
      if (this.doesEdgeBlockLineOfSight(
        checkEdgePoint.x,
        checkEdgePoint.y,
        checkEdgePoint.dir,
      )) {
        // console.log('checkPoint: CCW blocked at idx = ' + checkIndex);
        // console.log(checkEdgePoint);
        blockedCCW = true;
      }
    }
    return {blocked: blockedCW && blockedCCW};
  }

  /* x and y are in corner space, (0, 0) to (width, height) inclusive */
  checkRay(
    source: RayCastPoint,
    dest: RayCastPoint,
    ignoreFigures: bool,
  ): RayCheckResult {
    let sourcePoint = cellToPoint({x: source.x, y: source.y}, source.corner);
    let destPoint = cellToPoint({x: dest.x, y: dest.y}, dest.corner);
    let blocked = false;
    // console.log('checkRay', sourcePoint, destPoint);

    // Check start and end points
    if (_.isEqual(sourcePoint, destPoint)) {
      return {blocked: true};
    }
    let rayDirection = directionFromRay(
      sourcePoint.x,
      sourcePoint.y,
      destPoint.x,
      destPoint.y
    );
    if (!rayDirection) {
      throw new Error('could not find a valid direction');
    }
    blocked = blocked || this.checkPoint(
      sourcePoint,
      oppositeDirection(source.corner),
      rayDirection
    ).blocked;
    // console.log('after checking start point: ' + blocked);
    blocked = blocked || this.checkPoint(
      destPoint,
      oppositeDirection(rayDirection),
      oppositeDirection(dest.corner)
    ).blocked;
    // console.log('after checking end point: ' + blocked);

    invariant(rayDirection, 'no ray direction, cannot cast ray');
    // Check ray blockers
    blocked = blocked || !!gridCastRay(
      sourcePoint.x,
      sourcePoint.y,
      destPoint.x,
      destPoint.y,
      (x, y) => {
        if (ignoreFigures) {
          return;
        }
        // console.log('Checking cell: ', x, y);
        if ((x === source.x && y === source.y) || (x === dest.x && y === dest.y)) {
          // console.log('cell is source or target so not blocking');
          return;
        }
        const cell = this.getCell(x, y);
        // console.log(x, y, cell);
        if (cell === 'Empty') {
          return;
        }
        // console.log('ray blocked by cell:', x, y);
        return true;
      },
      (x, y, dir) => {
        if (!this.doesEdgeBlockLineOfSight(x, y, dir)) {
          return;
        }
        return true;
      },
      (x, y) => {
        invariant(rayDirection, 'no ray direction, cannot cast ray');
        if (!this.checkPoint(
          {x, y},
          oppositeDirection(rayDirection),
          rayDirection,
          ).blocked) {
          return;
        }
        // console.log('blocked by point:', x, y);
        return true;
      },
    );
    // console.log('after checking gridCastRay: ' + blocked);
    return {blocked};
  }

  /* x and y are in cell space */
  areCellsConnected(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): bool {
    throw new Error('unimplemented');
  }

  printLineOfSightResult(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    result: LineOfSightResult
  ): void {
    if (!result.hasLineOfSight) {
      this.printBoard({x: sourceX, y: sourceY}, {x: targetX, y: targetY});
      return;
    }
    let markedCorners = [];
    if (!result.sourceCorner) {
      throw new Error('no source corner specified in LoS result');
    }
    markedCorners.push(cellToPoint(
      {x: sourceX, y: sourceY},
      result.sourceCorner
    ));
    if (!result.targetCorners) {
      throw new Error('no target corners specified in LoS result');
    }
    for (let i = 0; i < result.targetCorners.length; i++) {
      markedCorners.push(cellToPoint(
        {x: targetX, y: targetY},
        result.targetCorners[i]
      ));
    }
    this.printBoard({x: sourceX, y: sourceY}, {x: targetX, y: targetY}, markedCorners);
  }

  printBoard(
    source: ?Point,
    target: ?Point,
    markedCorners: ?Array<Point>,
  ): void {
    const HORIZONTAL_EDGE = {
      'Clear': ' ',
      'Wall': '━',
      'Blocking': '─',
      'Impassable': '┄',
    }
    const VERTICAL_EDGE = {
      'Clear': ' ',
      'Wall': '┃',
      'Blocking': '│',
      'Impassable': '┆',
    }
    let text = ''
    for (let j = 0; j < this.height; j++) {
      if (true) {
        for (let i = 0; i < this.width; i++) {
          text += (!!_.find(markedCorners, {x: i, y: j})) ? 'o' : '+';
          const edge = this.getEdge(i, j, 'Right');
          text += HORIZONTAL_EDGE[edge];
        }
        text += (!!_.find(markedCorners, {x: this.width, y: j})) ? 'o' : '+';
        text += '\n';
      }
      for (let i = 0; i < this.width; i++) {
        if (true) {
          text += VERTICAL_EDGE[this.getEdge(i, j, 'Down')];
        }
        const cell = this.getCell(i, j);
        if (_.isEqual({x: i, y: j}, source)) {
          text += 'S';
        } else if (_.isEqual({x: i, y: j}, target)) {
          text += 'T';
        } else if (cell === 'Empty') {
          text += ' ';
        } else if (cell == 'OutOfBounds') {
          text += '■';
        } else if (cell === 'Blocking') {
          text += 'X';
        } else {
          invariant(false, 'unknown cell: %s', cell);
        }
      }
      text += VERTICAL_EDGE[this.getEdge(this.width, j, 'Down')];
      text += '\n';
    }
    for (let i = 0; i < this.width; i++) {
      text += (!!_.find(markedCorners, {x: i, y: this.height})) ? 'o' : '+';
      text += HORIZONTAL_EDGE[this.getEdge(i, this.height, 'Right')];
    }
    text += (!!_.find(markedCorners, {x: this.width, y: this.height})) ? 'o' : '+';
    console.log(text);
  }
}

export function boardFromRows(rows: Array<Array<string>>): Board {
  const INPUT_TO_CELL_MAP = {
    ' ': 'Empty',
    'X': 'Blocking',
  };
  const INPUT_TO_EDGE_MAP = {
    ' ': 'Clear',
    '|': 'Blocking',
    '-': 'Blocking',
  };
  const height = Math.floor(rows.length / 2);
  const width = Math.floor(rows[0].length / 2);
  rows.forEach((row, i) => {
    if (row.length !== (width * 2) + 1) {
      throw new Error(`Row ${i} has invalid length ${row.length}; expected ${width}`);
    }
  });
  const board = [];
  const rightEdges = [];
  const downEdges = [];
  const flattenedBoard = _.flatten(rows);

  for (let i = 0; i < flattenedBoard.length; i++) {
    const a = i % (width * 2 + 1);
    const b = Math.floor(i / (width * 2 + 1));
    if (a % 2 === 1 && b % 2 === 1) {
      let cell = INPUT_TO_CELL_MAP[flattenedBoard[i]];
      if (!cell) {
        const x = i % width;
        const y = Math.floor(i / width);
        throw new Error(`bad input at: (${a}, ${b})`);
      }
      board.push(cell);
    }
    else if (a % 2 === 1 && b % 2 === 0 && b !== height * 2) {
      let edge;
      if (b === 0) {
        edge = 'Blocking';
      }
      else {
        edge = INPUT_TO_EDGE_MAP[flattenedBoard[i]];
        if (!edge) {
          const x = i % width;
          const y = Math.floor(i / width);
          throw new Error(`bad input at: (${a}, ${b})`);
        }
      }
      rightEdges.push(edge);
    }
    else if (a % 2 === 0 && b % 2 === 1 && a !== width * 2) {
      let edge;
      if (a === 0) {
        edge = 'Blocking';
      }
      else {
        edge = INPUT_TO_EDGE_MAP[flattenedBoard[i]];
        if (!edge) {
          const x = i % width;
          const y = Math.floor(i / width);
          throw new Error(`bad input at: (${a}, ${b})`);
        }
      }
      downEdges.push(edge);
    }
  }
  return new Board(width, height, board, rightEdges, downEdges);
}

export function boardFromMapFile(contents: string): Board {
  let rows = contents.split('\n');
  rows = rows.filter(s => s.length > 0);
  rows = rows.map(row => row.split(''));
  return boardFromRows(rows);
}

export function emptyBoard(width: number, height: number): Board {
  const count = width * height;
  const fillArray = (v) => _.fill(new Array(count), v);
  return new Board(
    width,
    height,
    fillArray('Empty'),
    fillArray('Clear'),
    fillArray('Clear'),
  );
}
