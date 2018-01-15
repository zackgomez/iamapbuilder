/* @flow weak */

'use strict';

import 'pixi.js';
import Board, {emptyBoard, boardFromMapFile, cellToPoint} from './board.js';
import type {Point} from './board.js';
import 'isomorphic-fetch';
import _ from 'lodash';
import nullthrows from 'nullthrows';

import type {ToolEnum, UIState, Tool, ToolContext} from './tools.js';
import {getToolDefinitions} from './tools.js';
import type {Piece} from './Piece.js';
import {makeButton} from './UIUtils.js';


const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;

let renderer = new PIXI.autoDetectRenderer(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
renderer.backgroundColor = 0x777777;
//renderer.autoResize = true;

if (document.body) {
  document.body.appendChild(renderer.view);
  renderer.view.addEventListener('contextmenu', (e) => { e.preventDefault(); });
}

const interactionManager = renderer.plugins.interaction;

const SCALE = 50;

function getGridLayer(board: Board) {
  const width = board.getWidth();
  const height = board.getHeight();
  const grid = new PIXI.Graphics();
  grid.lineStyle(2, 0x222222, 1);
  for (let x = 0; x <= width; x++) {
    grid.moveTo(x * SCALE, 0);
    grid.lineTo(x * SCALE, height * SCALE);
  }
  for (let y = 0; y <= height; y++) {
    grid.moveTo(0, y * SCALE);
    grid.lineTo(width * SCALE, y * SCALE);
  }

  grid.beginFill(0x000000, 1);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const cell = board.getCell(x, y);
      if (cell === 'OutOfBounds') {
        grid.drawRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
  }
  grid.endFill();
  return grid;
}

function getEdgeLayer(board) {
  let edgeGraphics = new PIXI.Graphics();

  for (let x = 0; x <= board.getWidth(); x++) {
    for (let y = 0; y <= board.getHeight(); y++) {
      ['Down', 'Right'].forEach(dir => {
        if (!board.isValidEdge(x, y, dir)) {
          return;
        }
        const edge = board.getEdge(x, y, dir);
        if (edge === 'Clear') {
          return;
        } else if (edge === 'Blocking' || edge === 'Impassable') {
          edgeGraphics.lineStyle(4, 0xFF0000, 1);
        } else if (edge === 'Wall') {
          edgeGraphics.lineStyle(6, 0x000000, 1);
        }

        const xdir = (dir === 'Right' ? 1 : 0);
        const ydir = (dir === 'Down' ? 1 : 0);

        if (edge === 'Impassable') {
          edgeGraphics.moveTo(
            SCALE * x,
            SCALE * y,
          );
          edgeGraphics.lineTo(
            SCALE * (x + xdir * 1/6),
            SCALE * (y + ydir * 1/6),
          );
          edgeGraphics.moveTo(
            SCALE * (x + xdir * 2/6),
            SCALE * (y + ydir * 2/6),
          );
          edgeGraphics.lineTo(
            SCALE * (x + xdir * 4/6),
            SCALE * (y + ydir * 4/6),
          );
          edgeGraphics.moveTo(
            SCALE * (x + xdir * 5/6),
            SCALE * (y + ydir * 5/6),
          );
          edgeGraphics.lineTo(
            SCALE * (x + xdir * 6/6),
            SCALE * (y + ydir * 6/6),
          );
          return;
        }

        edgeGraphics.moveTo(SCALE * x, SCALE * y);
        edgeGraphics.lineTo(
          SCALE * (x + xdir),
          SCALE * (y + ydir)
        );
      });
    }
  }

  return edgeGraphics;
}


let nextFigureID = 1;
function makeFigureID(): string {
  return 'id' + nextFigureID++;
}
function makeFigureView(id: string, type: string, color: any, x: number, y: number) {
  let figure = new PIXI.Graphics();
  figure.beginFill(color);
  figure.drawCircle(0, 0, SCALE / 2);
  figure.endFill();
  figure.lineStyle(2, 0x000000, 1);
  figure.drawCircle(0, 0, SCALE / 2);
  figure.endFill();
  figure.x = x * SCALE + SCALE / 2;
  figure.y = y * SCALE + SCALE / 2;
  figure.interactive = true;

  figure.id = id;
  figure.type = type;

  return figure;
}
function makeFigure(
  id: string,
  type: string,
  color: number,
  cellX: number,
  cellY: number,
): Piece {
  return {
    id,
    type,
    color,
    cellX,
    cellY,
    dragPosition: null,
  };
}

let figures: {[key: string]: Piece} = {};

function setupFigures() {
  figures = {};
  const source = makeFigure(makeFigureID(), 'source', 0x0000FF, 2, 2);
  figures[source.id] = source;

  const target = makeFigure(makeFigureID(), 'target', 0xDD1122, 2, 3);
  figures[target.id] = target;

  _.times(4, (i) => {
    const fig = makeFigure(makeFigureID(), 'neutral', 0x333333, i, 0);
    figures[fig.id] = fig;
  });
}

function makeFigureLayer() {
  let layer = new PIXI.Container();
  _.each(figures, (figure, id) => {
    const view = makeFigureView(
      figure.id, figure.type, figure.color, figure.cellX, figure.cellY
    );
    if (figure.dragPosition) {
      view.x = figure.dragPosition.x;
      view.y = figure.dragPosition.y;
    }
    layer.addChild(view);
  });

  return layer;
}

let stage = null;
function render() {
  if (stage) {
    stage.destroy({children: true});
    stage = null;
  }
  uiState.needsRender = false;
  const mousePosition = interactionManager.mouse.global;

  const root = new PIXI.Container();

  const board = globalBoard;
  if (board) {
    root.addChild(getGridLayer(board));
    root.addChild(getEdgeLayer(board));
    if (uiState.currentTool.showFigureLayer(uiState, getToolContext())) {
      root.addChild(makeFigureLayer());
    }
    root.addChild(makeUILayer(uiState));
  }

  let mouseInfo = new PIXI.Text('Derp', new PIXI.TextStyle({
    fontSize: 12,
    stroke: '#00FF00',
    fill: '#00FF00',
  }));
  mouseInfo.text = `Mouse x: ${mousePosition.x} y: ${mousePosition.y}`;

  root.addChild(mouseInfo);
  stage = root;

  renderer.render(root);
}

function getToolContext(): ToolContext {
  const cellPositionFromEvent = (e) => {
    return {
      x: Math.floor(e.data.global.x / SCALE),
      y: Math.floor(e.data.global.y / SCALE),
    }
  };
  return {
    figures,
    SCALE,
    board: globalBoard,
    viewWidth: VIEWPORT_WIDTH,
    viewHeight: VIEWPORT_HEIGHT,
    cellPositionFromEvent,
    setBoard,
  };
}

function renderIfNecessary(): void {
  if (uiState.needsRender) {
    render();
  }
}

interactionManager.on('mousemove', e => {
  uiState = uiState.currentTool.onMouseMove(e, uiState, getToolContext());
  renderIfNecessary();
});
interactionManager.on('mousedown', e => {
  uiState = uiState.currentTool.onMouseDown(e, uiState, getToolContext());
  renderIfNecessary();
});
interactionManager.on('mouseup', e => {
  uiState = uiState.currentTool.onMouseUp(e, uiState, getToolContext());
  renderIfNecessary();
});
interactionManager.on('rightdown', e => {
  uiState = uiState.currentTool.onRightDown(e, uiState, getToolContext());
  renderIfNecessary();
});
interactionManager.on('rightup', e => {
  uiState = uiState.currentTool.onRightUp(e, uiState, getToolContext());
  renderIfNecessary();
});


const allTools = getToolDefinitions();

let uiState: UIState = {
  currentTool: allTools[0],
  availableTools: allTools,
  needsRender: true,
};

function setCurrentTool(newTool: Tool): void {
  uiState.currentTool = newTool;
  uiState.needsRender = true;
  renderIfNecessary();
}

function makeUILayer(state: UIState) {
  let layer = new PIXI.Container();

 const toolLayer = uiState.currentTool.renderLayer(
   uiState,
   getToolContext(),
 );
 if (toolLayer) {
   layer.addChild(toolLayer);
 }


  const BUTTON_SIZE = {width: 50, height: 30};
  let x = VIEWPORT_WIDTH - 10 - BUTTON_SIZE.width;
  let y = 10;

  state.availableTools.forEach((tool) => {
    const selected = tool === state.currentTool;
    const style = {
      fill: selected ? '#00FF00' : '#FFFFFF',
    }
    const button = makeButton(
      tool.getName(),
      BUTTON_SIZE,
      style,
      () => {
        setCurrentTool(tool);
      },
    );
    button.x = x;
    button.y = y;
    y += BUTTON_SIZE.height;
    layer.addChild(button);
  });

  return layer;
}

let globalBoard = null;
function setBoard(board) {
  globalBoard = board;
  setupFigures();
  uiState.needsRender = true;
}

(() => {
  const board = emptyBoard(10, 10);
  setBoard(board);
  board.printBoard();
  render();
})();

/*
fetch('/api/board').then(response => {
  if (!response.ok) {
    alert('Unable to fetch board');
  }
  return response.text();
}).then(text => {
  const board = boardFromMapFile(text);
  board.clearBlocking();
  board.printBoard();
  setBoard(board);
});
*/
