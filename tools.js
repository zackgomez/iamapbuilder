/* @flow */
'use strict';

import _ from 'lodash';
import nullthrows from 'nullthrows';

import Board from './board';
import type {Cell,  EdgeDirection, Edge} from './board';
import {makeButton} from './UIUtils';

export type ToolEnum = 'pointer' | 'terrain';

declare var PIXI: any;

export type UIState = {
  currentTool: Tool,
  availableTools: Array<Tool>,
  needsRender: boolean,
};

export type Point = {|
  x: number,
  y: number,
|};

export type ToolContext = {
  board: Board,
  SCALE: number,
  viewWidth: number,
  viewHeight: number,

  cellPositionFromEvent: (e: any) => Point,
  setBoard: (board: Board) => void,
};

export class Tool {
  getName(): string {
    throw new Error('unimplemented');
  }
  onMouseDown(event: any, state: UIState, context: ToolContext): UIState {
    return state;
  }
  onMouseMove(event: any, state: UIState, context: ToolContext): UIState {
    return state;
  }
  onMouseUp(event: any, state: UIState, context: ToolContext): UIState {
    return state;
  }
  onRightDown(event: any, state: UIState, context: ToolContext): UIState {
    return state;
  }
  onRightUp(event: any, state: UIState, context: ToolContext): UIState {
    return state;
  }

  showFigureLayer(state: UIState, context: ToolContext): boolean {
    return true;
  }
  renderLayer(state: UIState, context: ToolContext): any {
    return null;
  }
}


type TerrainSubtool = 'Cell' | 'Edge';
type CellType = 'OutOfBounds' | 'InBounds' | 'Difficult';

export class TerrainTool extends Tool {
  selectedSubtool_: TerrainSubtool = 'Cell';
  dragging_: boolean = false;
  dragCellType_: ?CellType = null;
  dragEdgeType_: ?Edge = null;

  cellType_: CellType = 'OutOfBounds';
  candidateCell_: ?Point;

  edgeType_: Edge = 'Wall';
  candidateEdge_: ?[Point, EdgeDirection];

  getName(): string {
    return 'Terrain';
  }

  setCellIfPossible(board: Board, cellPosition: Point, cell: CellType): boolean {
    if (!board.isValidCell(cellPosition.x, cellPosition.y)) {
      return false;
    }

    const existing = board.getCell(cellPosition.x, cellPosition.y);

    let newCell = {...existing};
    newCell.inBounds = cell !== 'OutOfBounds';
    newCell.difficultTerrain = cell === 'Difficult';

    board.setCell(cellPosition.x, cellPosition.y, newCell);
    return true;
  }

  affectedEdgeFromEvent(event: any, context: ToolContext): ?[Point, EdgeDirection] {
    let x = event.data.global.x / context.SCALE;
    let y = event.data.global.y / context.SCALE;
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const xFrac = x - cellX;
    const yFrac = y - cellY;

    const THRESHOLD = 0.3;

    const point = {x: cellX, y: cellY};

    let candidates = [
      [[{x: cellX, y: cellY}, 'Vertical'], xFrac], // Left
      [[{x: cellX + 1, y: cellY}, 'Vertical'], 1 - xFrac], // Right
      [[{x: cellX, y: cellY}, 'Horizontal'], yFrac], // Top
      [[{x: cellX, y: cellY + 1}, 'Horizontal'], 1 - yFrac], // Bottom
    ];

    candidates = candidates.sort(([a, distA], [b, distB]) => distA - distB);
    const [bestRet, bestDist] = candidates[0];
    if (bestDist > THRESHOLD) {
      return null;
    }

    const CORNER_THRESHOLD = 0.2;
    if (candidates[1][1] < CORNER_THRESHOLD) {
      return null;
    }

    if (!context.board.isValidEdge(bestRet[0].x, bestRet[0].y, bestRet[1])) {
      console.log('invalid edge', bestRet[0].x, bestRet[0].y, bestRet[1]);
      return null;
    }

    return bestRet;
  }
  candidateCellFromEvent(event: any, context: ToolContext): ?Point {
    const point = context.cellPositionFromEvent(event);
    if (context.board.isValidCell(point.x, point.y)) {
      return point;
    }
    return null;
  }

  onMouseDown(event: any, state: UIState, context: ToolContext): UIState {
    const cellPosition = context.cellPositionFromEvent(event);
    const board = context.board;

    if (!board.isValidCell(cellPosition.x, cellPosition.y)) {
      return state;
    }

    switch (this.selectedSubtool_) {
      case 'Cell':
        if (!this.candidateCell_) {
          return state;
        }
        this.dragCellType_ = this.cellType_;
        break;

      case 'Edge':
        if (!this.candidateEdge_) {
          return state;
        }
        this.dragEdgeType_ = this.edgeType_;
        break;
    }

    this.dragging_ = true;
    this.writeIfPossible(context);

    state.needsRender = true;
    return state;
  }
  writeIfPossible(context: ToolContext): void {
    if (!this.dragging_) {
      return;
    }
    switch (this.selectedSubtool_) {
      case 'Cell':
        if (this.candidateCell_) {
          this.setCellIfPossible(
            context.board,
            this.candidateCell_,
            nullthrows(this.dragCellType_),
          );
        }
        break;

      case 'Edge':
        if (this.candidateEdge_) {
          const [{x, y}, dir] = this.candidateEdge_;
          context.board.setEdge(x, y, dir, nullthrows(this.dragEdgeType_));
        }
        break;
    }
  }
  onMouseMove(event: any, state: UIState, context: ToolContext): UIState {
    state.needsRender = true;
    switch (this.selectedSubtool_) {
      case 'Cell':
        this.candidateEdge_ = null;
        this.candidateCell_ = this.candidateCellFromEvent(event, context);
        break;
      case 'Edge':
        this.candidateEdge_ = this.affectedEdgeFromEvent(event, context);
        this.candidateCell_ = null;
        break;
    }

    this.writeIfPossible(context);

    return state;
  }
  endDragging_(): void {
    this.dragging_ = false;
    this.dragCellType_ = null;
    this.dragEdgeType_ = null;
  }
  onMouseUp(event: any, state: UIState, context: ToolContext): UIState {
    this.endDragging_();
    return state;
  }
  onRightDown(event: any, state: UIState, context: ToolContext): UIState {
    if (this.dragging_) {
      return state;
    }
    if (this.selectedSubtool_ === 'Cell') {
      this.dragCellType_ = 'OutOfBounds';
    } else if (this.selectedSubtool_ === 'Edge') {
      this.dragEdgeType_ = 'Nothing';
    }
    this.dragging_ = true;
    this.writeIfPossible(context);
    state.needsRender = true;
    return state;
  }
  onRightUp(event: any, state: UIState, context: ToolContext): UIState {
    this.endDragging_();
    return state;
  }

  showFigureLayer(state: UIState, context: ToolContext): boolean {
    return false;
  }
  renderLayer(state: UIState, context: ToolContext): any {
    const layer = new PIXI.Container();

    const BUTTON_SIZE = {
      width: 100,
      height: 15,
    };
    const PADDING = 10;
    let x = context.viewWidth - PADDING - BUTTON_SIZE.width;
    let y = context.viewHeight - PADDING - BUTTON_SIZE.height;

    const addButton = (title: string, onClick: () => void) => {
      const button = makeButton(title, BUTTON_SIZE, {}, onClick);
      button.x = x;
      button.y = y;
      layer.addChild(button);
      y -= PADDING + BUTTON_SIZE.height;
    };

    const BUTTONS = [
      ['Cell', 'Difficult'],
      ['Cell', 'InBounds'],
      ['Edge', 'TileBoundary'],
      ['Edge', 'CellBoundary'],
      ['Edge', 'Difficult'],
      ['Edge', 'Impassable'],
      ['Edge', 'Blocking'],
      ['Edge', 'Wall'],
    ];
    BUTTONS.forEach(([subtool, type]) => {
      const title = subtool + type;
      addButton(title, () => {
        this.selectedSubtool_ = subtool;
        if (this.selectedSubtool_ === 'Edge') {
          this.edgeType_ = (type: any);
        } else if (this.selectedSubtool_ === 'Cell') {
          this.cellType_ = (type: any);
        }
      });
    });

    y -= 2 * BUTTON_SIZE.height;

    const {board} = context;
    const MAP_BUTTONS = [
    ];
    MAP_BUTTONS.forEach(([title, onClick]) => {
      addButton(title, onClick);
    });

    const candidateEdge = this.candidateEdge_;
    if (candidateEdge) {
      let edgeOverlay = new PIXI.Graphics();
      edgeOverlay.lineStyle(6, 0x4444ee, 0.8);
      const [xdir, ydir] = candidateEdge[1] === 'Vertical' ? [0, 1] : [1, 0];
      edgeOverlay.moveTo(
        context.SCALE * candidateEdge[0].x,
        context.SCALE * candidateEdge[0].y,
      );
      edgeOverlay.lineTo(
        context.SCALE * (candidateEdge[0].x + xdir),
        context.SCALE * (candidateEdge[0].y + ydir),
      );
      layer.addChild(edgeOverlay);
    }
    const candidateCell = this.candidateCell_;
    if (candidateCell) {
      let cellOverlay = new PIXI.Graphics();
      cellOverlay.beginFill(0x4444ee, 0.5);
      cellOverlay.drawRect(
        context.SCALE * candidateCell.x,
        context.SCALE * candidateCell.y,
        context.SCALE,
        context.SCALE,
      );
      cellOverlay.endFill();
      layer.addChild(cellOverlay);
    }

    return layer;
  }
}

export function getToolDefinitions(): Array<Tool> {
  return [new TerrainTool()];
}