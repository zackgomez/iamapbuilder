/* @flow */
'use strict';

import _ from 'lodash';
import nullthrows from 'nullthrows';

import Board from '../lib/board';
import type { Cell, EdgeDirection, Edge } from '../lib/board';
import { makeButton } from './UIUtils';
import { checkBoardTiles } from '../lib/BoardUtils';
import ApolloClient from 'apollo-boost';
import gql from 'graphql-tag';

import FileSaver from 'file-saver';

export type ToolEnum = 'pointer' | 'terrain';

declare var PIXI: any;

export type UIState = {
  currentTool: Tool,
  availableTools: Array<Tool>,
  needsRender: boolean,
  index: ?number,
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
  fetchMap: (index: number) => void,
  apollo: ApolloClient,
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

type TerrainSubtool = 'Cell' | 'Edge' | 'TileNumber';
type CellType = 'OutOfBounds' | 'InBounds' | 'Difficult';

export class TerrainTool extends Tool {
  selectedSubtool_: TerrainSubtool = 'Cell';
  dragging_: boolean = false;
  dragCellType_: ?CellType = null;
  dragEdgeType_: ?Edge = null;

  candidateCell_: ?Point;

  edgeType_: Edge = 'Wall';
  candidateEdge_: ?[Point, EdgeDirection];

  getName(): string {
    return 'Terrain';
  }

  setCellIfPossible(
    board: Board,
    cellPosition: Point,
    cell: CellType,
  ): boolean {
    if (!board.isValidCell(cellPosition.x, cellPosition.y)) {
      return false;
    }

    const existing = board.getCell(cellPosition.x, cellPosition.y);

    let newCell = { ...existing };
    newCell.inBounds = cell !== 'OutOfBounds';
    newCell.difficultTerrain = cell === 'Difficult';

    board.setCell(cellPosition.x, cellPosition.y, newCell);
    return true;
  }

  affectedEdgeFromEvent(
    event: any,
    context: ToolContext,
  ): ?[Point, EdgeDirection] {
    let x = event.data.global.x / context.SCALE;
    let y = event.data.global.y / context.SCALE;
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const xFrac = x - cellX;
    const yFrac = y - cellY;

    const THRESHOLD = 0.3;

    const point = { x: cellX, y: cellY };

    let candidates = [
      [[{ x: cellX, y: cellY }, 'Vertical'], xFrac], // Left
      [[{ x: cellX + 1, y: cellY }, 'Vertical'], 1 - xFrac], // Right
      [[{ x: cellX, y: cellY }, 'Horizontal'], yFrac], // Top
      [[{ x: cellX, y: cellY + 1 }, 'Horizontal'], 1 - yFrac], // Bottom
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
        if (event.data.originalEvent.button === 1) {
          this.dragCellType_ = 'Difficult';
        } else {
          this.dragCellType_ = 'InBounds';
        }
        break;

      case 'Edge':
        if (!this.candidateEdge_) {
          return state;
        }
        this.dragEdgeType_ = this.edgeType_;
        break;
      case 'TileNumber':
        //if (!this.candidateCell_) {
        //return state;
        //}
        let text = prompt('Text:');
        if (text === '') {
          text = null;
        }
        board.setCell(cellPosition.x, cellPosition.y, {
          ...board.getCell(cellPosition.x, cellPosition.y),
          tileNumber: text,
        });
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
          const [{ x, y }, dir] = this.candidateEdge_;
          context.board.setEdge(x, y, dir, nullthrows(this.dragEdgeType_));
        }
        break;
    }
  }
  onMouseMove(event: any, state: UIState, context: ToolContext): UIState {
    state.needsRender = true;
    switch (this.selectedSubtool_) {
      case 'Cell':
      case 'TileNumber':
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
  onNew(state: UIState, context: ToolContext): void {
    if (confirm('Create a new Board?')) {
      context.setBoard(new Board(26, 50));
    }
  }
  onFetch(state: UIState, context: ToolContext): void {
    const index = parseInt(prompt('Index?'));
    if (index === NaN) {
      return;
    }
    context.fetchMap(index);
  }
  onSearch(state: UIState, context: ToolContext): void {
    const query = prompt('Map name?');
    context.fetchIndexOfMap(query).then(index => {
      if (index === null) {
        // TODO alert
        return;
      }
      context.fetchMap(index);
    });
  }
  onNext(state: UIState, context: ToolContext): void {
    let index = this.getCurrentIndex(state);
    if (index === null) {
      index = -1;
    }
    context.fetchMap(index + 1);
  }
  onPrev(state: UIState, context: ToolContext): void {
    const index = this.getCurrentIndex(state) || 1;
    context.fetchMap(index - 1);
  }
  getCurrentIndex(state: UIState): ?number {
    return state.index;
  }
  onPut(state: UIState, context: ToolContext): void {
    const index = this.getCurrentIndex(state);
    if (index === null) {
      return;
    }

    context.apollo
      .mutate({
        mutation: gql`
          mutation UpdateMap($index: Int!, $data: String!) {
            update_map(index: $index, data: $data) {
              success
              map {
                index
              }
            }
          }
        `,
        variables: {
          index,
          data: context.board.serialize(),
        },
        /* TODO reenable this
        refetchQueries: (result: any) => {
          const variables = {index};
          return [
            {
              query: FetchMapQuery,
              variables,
            },
          ];
        },
        */
      })
      .then(result => {
        console.log(result);
      });
  }
  onComputeEdges(state: UIState, context: ToolContext): void {
    context.board.applyEdgeRules();
  }
  onCheckTiles(state: UIState, context: ToolContext): void {
    const result = checkBoardTiles(context.board);

    const lines = [];
    result.forEach((v, k) => {
      if (v < 0) {
        lines.push(`${-v} missing ${k}`);
      } else if (v > 0) {
        lines.push(`${v} extra ${k}`);
      }
    });
    if (lines.length === 0) {
      alert('All tiles check out');
      return;
    }

    alert(lines.join('\n'));
  }
  renderLayer(state: UIState, context: ToolContext): any {
    const layer = new PIXI.Container();

    const BUTTON_SIZE = {
      width: 150,
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

    const makeSubtoolButtonItem = (
      subtool: TerrainSubtool,
      type: CellType | Edge,
    ): [string, () => void] => {
      const title = subtool + ' : ' + type;
      const onClick = () => {
        this.selectedSubtool_ = subtool;
        if (this.selectedSubtool_ === 'Edge') {
          this.edgeType_ = (type: any);
        }
      };
      return [title, onClick];
    };

    const CELL_BUTTONS = [
      [
        'Cell',
        () => {
          this.selectedSubtool_ = 'Cell';
        },
      ],
      [
        'Cell : Tile Number',
        () => {
          this.selectedSubtool_ = 'TileNumber';
        },
      ],
    ];
    const EDGE_BUTTONS = [
      ['Edge', 'Wall'],
      ['Edge', 'TileBoundary'],
      ['Edge', 'CellBoundary'],
      ['Edge', 'Blocking'],
      ['Edge', 'Impassible'],
    ].map(([a, b]) => makeSubtoolButtonItem(a, b));

    const FILE_BUTTONS = [
      ['New', () => this.onNew(state, context)],
      ['Fetch', () => this.onFetch(state, context)],
      ['Search', () => this.onSearch(state, context)],
      ['Put', () => this.onPut(state, context)],
      ['Prev', () => this.onPrev(state, context)],
      ['Next', () => this.onNext(state, context)],
    ];
    const MAP_BUTTONS = [
      ['Compute Edges', () => this.onComputeEdges(state, context)],
      ['Check Tiles', () => this.onCheckTiles(state, context)],
    ];

    const SECTIONS = [FILE_BUTTONS, MAP_BUTTONS, CELL_BUTTONS, EDGE_BUTTONS];

    SECTIONS.reverse();
    SECTIONS.forEach(section => {
      section.reverse();
      section.forEach(([title, onClick]) => {
        addButton(title, onClick);
      });
      y -= BUTTON_SIZE.height;
    });

    const { board } = context;
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
