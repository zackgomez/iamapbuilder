/* @flow */
import invariant from 'invariant';
import nullthrows from 'nullthrows';
import React from 'react';
import ReactDom from 'react-dom';
import themeable from 'react-themeable';

import Board from '../lib/board';
import {drawEdgeLayer, drawGridLayer} from '../lib/CanvasRenderer';


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
