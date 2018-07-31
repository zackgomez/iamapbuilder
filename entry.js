/* @flow weak */

'use strict';

import 'pixi.js';
import Board from './board.js';
import _ from 'lodash';
import nullthrows from 'nullthrows';
import React from 'react';
import ReactDOM from 'react-dom';

import type {ToolEnum, UIState, Tool, ToolContext} from './tools.js';
import {getToolDefinitions} from './tools.js';
import {makeButton, buttonizeText} from './UIUtils.js';
import {makeGridLayer, makeEdgeLayer} from './renderer.js';
import MapViewerApp from './viewer';

import ApolloClient from 'apollo-boost';

const SHOW_EDITOR = true;

let apolloClient = new ApolloClient({
  uri: 'http://localhost:3000/graphql',
});

if (SHOW_EDITOR) {
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

  const SHOW_MOUSE_INFO = false;

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
} else {
  ReactDOM.render(
    <MapViewerApp apollo={apolloClient} />,
    nullthrows(document.getElementById('app-container')),
  );
}
