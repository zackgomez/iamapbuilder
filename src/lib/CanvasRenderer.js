/* @flow */

import type Board, {Edge, EdgeDirection} from './board';

function drawGridLayer(ctx: CanvasRenderingContext2D, board: Board, scale: number): void {
  const width = board.getWidth();
  const height = board.getHeight();

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#999999';

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

function iterateLines(board: Board, dir: EdgeDirection, iterator: (x: number, y: number, edge: Edge) => void) {
  const w = board.getWidth() + 1, h = board.getHeight() + 1;
  for (let i = 0; i < w * h; i++) {
    const x = dir === 'Horizontal' ? i % w : Math.floor(i / h);
    const y = dir === 'Horizontal' ? Math.floor(i / w) : i % h;
    if (!board.isValidEdge(x, y, dir)) {
      continue;
    }
    const edge = board.getEdge(x, y, dir);
    iterator(x, y, edge);
  }
}

export function drawBoard(ctx: CanvasRenderingContext2D, board: Board, scale: number): void {
  drawGridLayer(ctx, board, scale);

  const EDGE_ORDER: Array<Edge> = ['CellBoundary', 'TileBoundary', 'Difficult', 'Impassible', 'Blocking', 'Wall'];

  EDGE_ORDER.forEach(targetEdge => {
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    let lineOffset = 0;
    if (targetEdge === 'Blocking') {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ff0000';
      lineOffset = 2;
    } else if (targetEdge === 'Impassible') {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ff0000';
      ctx.setLineDash([scale / 3, scale / 6]);
      ctx.lineDashOffset = scale / 6;
      lineOffset = 2;
    } else if (targetEdge === 'Wall') {
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000000';
      lineOffset = 2;
    } else if (targetEdge === 'TileBoundary') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
    } else if (targetEdge === 'CellBoundary') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#7f7f7f';
      ctx.setLineDash([scale / 10]);
      ctx.lineDashOffset = scale / 20;
    } else if (targetEdge === 'Difficult') {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#4f81bd';
      lineOffset = 2;
    }

    ctx.beginPath();
    ['Vertical', 'Horizontal'].forEach(dir => {
      const [xdir, ydir] = dir === 'Horizontal' ? [1, 0] : [0, 1];
      let startX: number | null = null;
      let startY: number | null = null;
      let lastX: number | null = null;
      let lastY: number | null = null;
      let memo: {x0: number, x1: number, y0: number, y1: number} | null = null;
      iterateLines(board, dir, (x, y, edge) => {
        // check for start of line
        if (startX !== null && startY !== null) {

          if ((dir === 'Horizontal' ? y !== startY : x !== startX) || edge !== targetEdge) {
            //console.log(`Draw ${targetEdge} from ${startX}, ${startY} to ${x}, ${y}`);
            ctx.moveTo(scale * startX - xdir * lineOffset, scale * startY - ydir * lineOffset);
            ctx.lineTo(scale * lastX + xdir * lineOffset, scale * lastY + ydir * lineOffset);

            startX = null;
            startY = null;
          } else {
            lastX = x + xdir;
            lastY = y + ydir;
          }
        }
        if (startX === null && edge === targetEdge) {
          // start new line
          startX = x;
          startY = y;
          lastX = x + xdir;
          lastY = y + ydir;
        }
      });
      if (startX !== null && startY !== null) {
        ctx.moveTo(scale * startX - lineOffset, scale * startY - lineOffset);
        ctx.lineTo(scale * lastX + lineOffset, scale * lastY + lineOffset);
      }
    });
    ctx.stroke();
  });
}
