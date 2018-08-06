/* @flow */

import Board from './board.js';
import 'pixi.js';
import _ from 'lodash';

import ApolloClient from 'apollo-boost';
import gql from 'graphql-tag';


import type {ToolEnum, UIState, Tool, ToolContext} from './tools.js';
import {getToolDefinitions} from './tools.js';
import {makeButton, buttonizeText} from './UIUtils.js';

const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 800;


let apolloClient = new ApolloClient({
  uri: 'http://localhost:3000/graphql',
});

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

const SHOW_MOUSE_INFO = false;

const TILE_NUMBER_TEXT_STYLE = new PIXI.TextStyle({
  fontSize: 15,
});

function makeGridLayer(board: Board, scale: number): any {
  const width = board.getWidth();
  const height = board.getHeight();
  const grid = new PIXI.Graphics();
  grid.lineStyle(1, '0x999999', 1);
  for (let x = 0; x <= width; x++) {
    grid.moveTo(x * scale, 0);
    grid.lineTo(x * scale, height * scale);
  }
  for (let y = 0; y <= height; y++) {
    grid.moveTo(0, y * scale);
    grid.lineTo(width * scale, y * scale);
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
        grid.drawRect(x * scale, y * scale, scale, scale);
      }
      if (cell.tileNumber && cell.tileNumber.length > 0) {
        const text = new PIXI.Text(cell.tileNumber, TILE_NUMBER_TEXT_STYLE);
        text.anchor.x = 0.5;
        text.anchor.y = 0.5;
        text.x = x * scale + scale / 2;
        text.y = y * scale + scale / 2;
        grid.addChild(text);
      }
    }
  }
  grid.endFill();

  return grid;
}

export function makeEdgeLayer(board: Board, scale: number): any {
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
          edgeGraphics.moveTo(scale * x, scale * y);
          edgeGraphics.lineTo(scale * (x + xdir * 1 / 6), scale * (y + ydir * 1 / 6));

          edgeGraphics.moveTo(scale * (x + xdir * 2 / 6), scale * (y + ydir * 2 / 6));
          edgeGraphics.lineTo(scale * (x + xdir * 4 / 6), scale * (y + ydir * 4 / 6));
          edgeGraphics.moveTo(scale * (x + xdir * 5 / 6), scale * (y + ydir * 5 / 6));
          edgeGraphics.lineTo(scale * (x + xdir * 6 / 6), scale * (y + ydir * 6 / 6));
          return;
        }
        if (edge === 'CellBoundary') {
          const N_DOTS = 5;
          for (let i = 0; i < N_DOTS; i++) {
            edgeGraphics.moveTo(
              scale * (x + xdir * i / N_DOTS),
              scale * (y + ydir * i / N_DOTS),
            );
            edgeGraphics.lineTo(
              scale * (x + xdir * (i + 0.5) / N_DOTS),
              scale * (y + ydir * (i + 0.5) / N_DOTS),
            );
          }
          return;
        }

        edgeGraphics.moveTo(scale * x, scale * y);
        edgeGraphics.lineTo(scale * (x + xdir), scale * (y + ydir));
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

  const root = new PIXI.Container();

  const board = globalBoard;
  if (board) {
    const layers = [
      makeGridLayer(board, SCALE),
      makeEdgeLayer(board, SCALE),
      makeUILayer(uiState, board),
    ];
    _.each(layers, layer => {
      layer.x = 10;
      layer.y = 10;
      root.addChild(layer);
    });
  }

  if (SHOW_MOUSE_INFO) {
    const mousePosition = interactionManager.mouse.global;
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
  }
  stage = root;

  renderer.render(root);
}


const FetchMapQuery = gql`
  query FetchMap($index: Int!) {
    map(index: $index) {
      data
    }
  }
`;

function fetchMap(index: number): void {
  apolloClient
    .query({
      query: FetchMapQuery,
      variables: {index},
    })
    .then(result => {
      return result.data.map.data;
    })
    .then(data => {
      const board = Board.fromSerialized(data);
      setBoard(board);
      setIndex(index);
    })
    .catch(e => console.error(e));
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
    fetchMap,
    apollo: apolloClient,
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
  index: null,
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
  if (name === '') {
    return;
  }
  globalBoard.setName(name);
  uiState.needsRender = true;
}
function onSetMapType(): void {
  const type = prompt('Map Type', globalBoard.getMapType()) || '';
  if (type === '') {
    return;
  }
  globalBoard.setMapType(type);
  uiState.needsRender = true;
}
function onSetBriefingLocation(): void {
  const briefingLocation =
    prompt('Briefing Location', globalBoard.getBriefingLocation()) || '';
  if (briefingLocation === '') {
    return;
  }
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

let globalBoard: Board = Board.emptyBoard(26, 50);
function setBoard(board) {
  globalBoard = board;
  uiState.needsRender = true;
  setTimeout(renderIfNecessary);
}
function setIndex(index: ?number): void {
  uiState.index = index;
  if (typeof index === 'number') {
    window.localStorage.setItem('mapbuilder.index', `${index}`);
  } else {
    window.localStorage.removeItem('mapbuilder.index');
  }
}

(() => {
  const savedIndex = window.localStorage.getItem('mapbuilder.index');
  if (savedIndex !== null) {
    const parsedIndex = parseInt(savedIndex);
    if (!isNaN(parsedIndex)) {
      uiState.index = parsedIndex;
      fetchMap(parsedIndex);
    }
  }

  let board = Board.emptyBoard(26, 50);
  setBoard(board);

  render();
})();
