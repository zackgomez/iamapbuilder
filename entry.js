/* @flow weak */

'use strict';

import 'pixi.js';
import Board from './board.js';
import 'isomorphic-fetch';
import _ from 'lodash';
import nullthrows from 'nullthrows';

import type {ToolEnum, UIState, Tool, ToolContext} from './tools.js';
import {getToolDefinitions} from './tools.js';
import {makeButton} from './UIUtils.js';

const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 800;

declare var PIXI: any;

let renderer = new PIXI.autoDetectRenderer(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
renderer.backgroundColor = 0xFFFFFF;
renderer.autoResize = true;

if (document.body) {
  document.body.appendChild(renderer.view);
  renderer.view.addEventListener('contextmenu', e => {
    e.preventDefault();
  });
}

const interactionManager = renderer.plugins.interaction;

const SCALE = 40;

function getGridLayer(board: Board) {
  const width = board.getWidth();
  const height = board.getHeight();
  const grid = new PIXI.Graphics();
  grid.lineStyle(1, '0x999999', 1);
  for (let x = 0; x <= width; x++) {
    grid.moveTo(x * SCALE, 0);
    grid.lineTo(x * SCALE, height * SCALE);
  }
  for (let y = 0; y <= height; y++) {
    grid.moveTo(0, y * SCALE);
    grid.lineTo(width * SCALE, y * SCALE);
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const cell = board.getCell(x, y);
      if (cell.difficultTerrain) {
        grid.beginFill(0xDBE5F1, 1);
      } else {
        grid.beginFill(0xEAF1DD, 1);
      }
      if (cell.inBounds) {
        grid.drawRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
  }
  grid.endFill();

  return grid;
}

function getEdgeLayer(board: Board) {
  let edgeGraphics = new PIXI.Graphics();

  for (let x = 0; x <= board.getWidth(); x++) {
    for (let y = 0; y <= board.getHeight(); y++) {
      ['Vertical', 'Horizontal'].forEach(dir => {
        if (!board.isValidEdge(x, y, dir)) {
          return;
        }
        const edge = board.getEdge(x, y, dir);
        if (edge === 'Nothing') {
          return;
        } else if (edge === 'Blocking' || edge === 'Impassible') {
          edgeGraphics.lineStyle(4, 0xff0000, 1);
        } else if (edge === 'Wall') {
          edgeGraphics.lineStyle(6, 0x000000, 1);
        } else if (edge === 'TileBoundary') {
          edgeGraphics.lineStyle(2, 0x000000, 1);
        } else if (edge === 'CellBoundary') {
          edgeGraphics.lineStyle(2, 0x7F7F7F, 1);
        } else if (edge === 'Difficult') {
          edgeGraphics.lineStyle(4, 0x4F81BD, 1);
        }

        const xdir = dir === 'Horizontal' ? 1 : 0;
        const ydir = dir === 'Vertical' ? 1 : 0;

        if (edge === 'Impassible') {
          edgeGraphics.moveTo(SCALE * x, SCALE * y);
          edgeGraphics.lineTo(SCALE * (x + xdir * 1 / 6), SCALE * (y + ydir * 1 / 6));

          edgeGraphics.moveTo(SCALE * (x + xdir * 2 / 6), SCALE * (y + ydir * 2 / 6));
          edgeGraphics.lineTo(SCALE * (x + xdir * 4 / 6), SCALE * (y + ydir * 4 / 6));
          edgeGraphics.moveTo(SCALE * (x + xdir * 5 / 6), SCALE * (y + ydir * 5 / 6));
          edgeGraphics.lineTo(SCALE * (x + xdir * 6 / 6), SCALE * (y + ydir * 6 / 6));
          return;
        }
        if (edge === 'CellBoundary') {
          const N_DOTS = 5;
          for (let i = 0; i < N_DOTS; i++) {
            edgeGraphics.moveTo(
                SCALE * (x + xdir * i / N_DOTS),
                SCALE * (y + ydir * i / N_DOTS),
                );
            edgeGraphics.lineTo(
                SCALE * (x + xdir * (i + 0.5) / N_DOTS),
                SCALE * (y + ydir * (i + 0.5) / N_DOTS),
                );
          }
          return;
        }

        edgeGraphics.moveTo(SCALE * x, SCALE * y);
        edgeGraphics.lineTo(SCALE * (x + xdir), SCALE * (y + ydir));
      });
    }
  }

  return edgeGraphics;
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
    root.addChild(makeUILayer(uiState));
  }

  let mouseInfo = new PIXI.Text(
    'Derp',
    new PIXI.TextStyle({
      fontSize: 12,
      stroke: '#000000',
      fill: '#000000',
    }),
  );
  mouseInfo.text = `Mouse x: ${mousePosition.x} y: ${mousePosition.y}`;

  root.addChild(mouseInfo);
  stage = root;

  renderer.render(root);
}

function getToolContext(): ToolContext {
  const cellPositionFromEvent = e => {
    return {
      x: Math.floor(e.data.global.x / SCALE),
      y: Math.floor(e.data.global.y / SCALE),
    };
  };
  return {
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

  const toolLayer = uiState.currentTool.renderLayer(uiState, getToolContext());
  if (toolLayer) {
    layer.addChild(toolLayer);
  }

  const BUTTON_SIZE = {width: 50, height: 30};
  let x = VIEWPORT_WIDTH - 10 - BUTTON_SIZE.width;
  let y = 10;

  state.availableTools.forEach(tool => {
    const selected = tool === state.currentTool;
    const style = {
      fill: selected ? '#00FF00' : '#FFFFFF',
    };
    const button = makeButton(tool.getName(), BUTTON_SIZE, style, () => {
      setCurrentTool(tool);
    });
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
  uiState.needsRender = true;
  setTimeout(renderIfNecessary);
}

(() => {
  const board = Board.emptyBoard(26, 50);
  setBoard(board);
  render();
})();
