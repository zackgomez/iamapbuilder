/* @flow weak */

'use strict';

import 'pixi.js';
import Board from './board.js';
import 'isomorphic-fetch';
import _ from 'lodash';
import nullthrows from 'nullthrows';

import type {ToolEnum, UIState, Tool, ToolContext} from './tools.js';
import {getToolDefinitions} from './tools.js';
import {makeButton, buttonizeText} from './UIUtils.js';

const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 800;

declare var PIXI: any;

let renderer = new PIXI.autoDetectRenderer(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
renderer.backgroundColor = 0xffffff;
renderer.autoResize = true;

if (document.body) {
  document.body.appendChild(renderer.view);
  renderer.view.addEventListener('contextmenu', e => {
    e.preventDefault();
  });
}

const interactionManager = renderer.plugins.interaction;

const SCALE = 40;

const TILE_NUMBER_TEXT_STYLE = new PIXI.TextStyle({
  fontSize: 15,
});

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
        grid.beginFill(0xdbe5f1, 1);
      } else {
        grid.beginFill(0xeaf1dd, 1);
      }
      if (cell.inBounds) {
        grid.drawRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
      if (cell.tileNumber && cell.tileNumber.length > 0) {
        const text = new PIXI.Text(cell.tileNumber, TILE_NUMBER_TEXT_STYLE);
        text.anchor.x = 0.5;
        text.anchor.y = 0.5;
        text.x = x * SCALE + SCALE / 2;
        text.y = y * SCALE + SCALE / 2;
        grid.addChild(text);
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
          edgeGraphics.lineStyle(2, 0x7f7f7f, 1);
        } else if (edge === 'Difficult') {
          edgeGraphics.lineStyle(4, 0x4f81bd, 1);
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
    root.addChild(makeUILayer(uiState, board));
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
    setFilename,
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
  filename: null,
};

function setCurrentTool(newTool: Tool): void {
  uiState.currentTool = newTool;
  uiState.needsRender = true;
  renderIfNecessary();
}

const MAP_INFO_TEXT_WIDTH = 300;
const MAP_INFO_TEXT_STYLE = new PIXI.TextStyle({
  fontSize: 20,
  wordWrap: true,
  wordWrapWidth: MAP_INFO_TEXT_WIDTH,
});
function onSetMapName(): void {
  const name = prompt('Map Name', globalBoard.getName()) || '';
  globalBoard.setName(name);
  uiState.needsRender = true;
}
function onSetMapType(): void {
  const type = prompt('Map Type', globalBoard.getMapType()) || '';
  globalBoard.setMapType(type);
  uiState.needsRender = true;
}
function onSetBriefingLocation(): void {
  const briefingLocation = prompt(
    'Briefing Location',
    globalBoard.getBriefingLocation(),
  ) || '';
  globalBoard.setBriefingLocation(briefingLocation);
  uiState.needsRender = true;
}
function makeUILayer(state: UIState, board: Board) {
  let layer = new PIXI.Container();

  const toolLayer = uiState.currentTool.renderLayer(uiState, getToolContext());
  if (toolLayer) {
    layer.addChild(toolLayer);
  }

  let x = VIEWPORT_WIDTH - MAP_INFO_TEXT_WIDTH;
  let y = 10;
  const mapNameText = new PIXI.Text(
    `Map Name: ${board.getName()}`,
    MAP_INFO_TEXT_STYLE,
  );
  mapNameText.x = x;
  mapNameText.y = y;
  y += 50;
  buttonizeText(mapNameText, () => {
    onSetMapName();
  });
  layer.addChild(mapNameText);

  const mapTypeText = new PIXI.Text(
    `Map Type: ${board.getMapType()}`,
    MAP_INFO_TEXT_STYLE,
  );
  mapTypeText.x = x;
  mapTypeText.y = y;
  y += 50;
  buttonizeText(mapTypeText, () => {
    onSetMapType();
  });
  layer.addChild(mapTypeText);

  const briefingLocationText = new PIXI.Text(
    `Briefing Location: ${board.getBriefingLocation()}`,
    MAP_INFO_TEXT_STYLE,
  );
  briefingLocationText.x = x;
  briefingLocationText.y = y;
  y += 30;
  buttonizeText(briefingLocationText, () => {
    onSetBriefingLocation();
  });
  layer.addChild(briefingLocationText);

  return layer;
}

let globalBoard = null;
function setBoard(board) {
  globalBoard = board;
  uiState.needsRender = true;
  setTimeout(renderIfNecessary);
}
function setFilename(filename: string): void {
  uiState.filename = filename;
}

(() => {
  let board = Board.emptyBoard(26, 50);

  const serialized = window.localStorage.getItem('mapbuilder.save');
  if (serialized) {
    board = Board.fromSerialized(serialized);
    uiState.filename = window.localStorage.getItem('mapbuilder.filename');
  }

  setBoard(board);
  render();
})();
