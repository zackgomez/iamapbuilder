/* @flow */
import 'pixi.js';
import * as React from 'react';
import ReactDom from 'react-dom';
import nullthrows from 'nullthrows';
import themeable from 'react-themeable';

import Board from './board';

declare var PIXI: any;

const TILE_NUMBER_TEXT_STYLE = new PIXI.TextStyle({
  fontSize: 15,
});

export function makeGridLayer(board: Board, scale: number): any {
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

type Props = {
  board: Board,
  theme: ?Object,
};

export class BoardRenderer extends React.Component<Props> {
  renderer: any;
  container: ?HTMLDivElement;
  root: ?any;

  componentDidMount() {}

  componentWillUnmount() {
    this.cleanup();
  }

  cleanup() {
    if (this.root) {
      this.root.destroy({children: true});
      this.root = null;
    }
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
  }

  setContainer(container: ?HTMLDivElement): void {
    if (this.renderer) {
      return;
    }
    this.container = container;

    if (!container) {
      return;
    }

    const {board} = this.props;

    const PADDING = 10;
    const screenWidth = container.clientWidth - 2 * PADDING;
    const screenHeight = container.clientHeight - 2 * PADDING - 50;

    const scale = Math.min(
      Math.floor(
        Math.min(screenWidth / board.getWidth(), screenHeight / board.getHeight()),
      ),
      50,
    );

    const renderer = new PIXI.autoDetectRenderer(
      board.getWidth() * scale + 2 * PADDING,
      board.getHeight() * scale + 2 * PADDING,
    );
    renderer.backgroundColor = 0xffffff;
    renderer.autoResize = true;

    console.log(
      scale,
      board.getWidth(),
      board.getHeight(),
      renderer.width,
      renderer.height,
    );

    this.renderer = renderer;

    container.appendChild(renderer.view);
    renderer.view.addEventListener('contextmenu', e => {
      e.preventDefault();
    });

    const root = new PIXI.Container();
    const layers = [makeGridLayer(board, scale), makeEdgeLayer(board, scale)];
    layers.forEach(layer => {
      layer.x = PADDING;
      layer.y = PADDING;
      root.addChild(layer);
    });

    renderer.render(root);
  }

  render() {
    const theme = themeable(this.props.theme);

    return (
      <div
        {...theme(1, 'canvasContainer')}
        ref={container => this.setContainer(container)}
      />
    );
  }
}
