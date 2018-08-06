/* @flow */
import invariant from 'invariant';
import nullthrows from 'nullthrows';
import React from 'react';
import ReactDom from 'react-dom';
import themeable from 'react-themeable';

import Board from './board';

function drawGridLayer(ctx: CanvasRenderingContext2D, board: Board, scale: number): void {
  const width = board.getWidth();
  const height = board.getHeight();

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#999999';
  ctx.beginPath();
  for (let x = 0; x <= width; x++) {
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, height * scale);
  }
  for (let y = 0; y <= height; y++) {
    ctx.moveTo(0, y * scale);
    ctx.lineTo(width * scale, y * scale);
  }
  ctx.stroke();

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const cell = board.getCell(x, y);
      if (cell.difficultTerrain) {
        ctx.fillStyle = '#dbe5f1';
      } else {
        ctx.fillStyle = '#eaf1dd';
      }
      if (cell.inBounds) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
      const tileNumber = cell.tileNumber;
      if (tileNumber && tileNumber.length > 0) {
        ctx.font = '15px sans-serif'
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'center';
        ctx.fillText(tileNumber, x * scale + scale / 2, y * scale + scale / 2, scale);
      }
    }
  }
}

function drawEdgeLayer(ctx: CanvasRenderingContext2D, board: Board, scale: number): void {
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
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ff0000';
        } else if (edge === 'Wall') {
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#000000';
        } else if (edge === 'TileBoundary') {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000000';
        } else if (edge === 'CellBoundary') {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#7f7f7f';
        } else if (edge === 'Difficult') {
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#4f81bd';
        }

        const xdir = dir === 'Horizontal' ? 1 : 0;
        const ydir = dir === 'Vertical' ? 1 : 0;

        ctx.beginPath();
        if (edge === 'Impassible') {
          ctx.moveTo(scale * x, scale * y);
          ctx.lineTo(scale * (x + xdir * 1 / 6), scale * (y + ydir * 1 / 6));

          ctx.moveTo(scale * (x + xdir * 2 / 6), scale * (y + ydir * 2 / 6));
          ctx.lineTo(scale * (x + xdir * 4 / 6), scale * (y + ydir * 4 / 6));
          ctx.moveTo(scale * (x + xdir * 5 / 6), scale * (y + ydir * 5 / 6));
          ctx.lineTo(scale * (x + xdir * 6 / 6), scale * (y + ydir * 6 / 6));
        } else if (edge === 'CellBoundary') {
          const N_DOTS = 5;
          for (let i = 0; i < N_DOTS; i++) {
            ctx.moveTo(
              scale * (x + xdir * i / N_DOTS),
              scale * (y + ydir * i / N_DOTS),
            );
            ctx.lineTo(
              scale * (x + xdir * (i + 0.5) / N_DOTS),
              scale * (y + ydir * (i + 0.5) / N_DOTS),
            );
          }
        } else {
          ctx.moveTo(scale * x, scale * y);
          ctx.lineTo(scale * (x + xdir), scale * (y + ydir));
        }
        ctx.stroke();
      });
    }
  }
}

type Props = {
  board: Board,
  theme: ?Object,
};

export class BoardRenderer extends React.Component<Props> {
  canvas: ?HTMLCanvasElement;

  setCanvas(canvas: ?HTMLCanvasElement): void {
    if (!canvas) {
      return;
    }
    this.canvas = canvas;
    const parent = nullthrows(canvas.parentElement);

    const {board} = this.props;
    const ctx = canvas.getContext('2d');
    const screenWidth = parent.clientWidth;
    const screenHeight = parent.clientHeight;
    const PADDING = 5;

    const scale = Math.max(Math.min(
      Math.floor(
        Math.min(screenWidth / board.getWidth(), screenHeight / board.getHeight()),
      ),
      50,
    ), 30);

    canvas.width = 2 * PADDING + board.getWidth() * scale;
    canvas.height = 2 * PADDING + board.getHeight() * scale;

    // background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    // padding
    ctx.translate(PADDING, PADDING);

    drawGridLayer(ctx, board, scale);
    drawEdgeLayer(ctx, board, scale);
  }

  componentDidMount() {
    window.addEventListener('resize', this.onWindowResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onWindowResize)
  }

  onWindowResize = (e: Event) => {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }

    // TODO resize canvas if necessary
  }

  render() {
    const theme = themeable(this.props.theme);

    return (
      <div {...theme(1, 'canvasContainer')}>
        <canvas
          ref={(canvas => this.setCanvas(canvas))}
        >
        </canvas>
      </div>
    );
  }
}
