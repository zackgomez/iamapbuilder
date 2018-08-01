/* @flow */
import _ from 'lodash';
import Board from './board';

/*
 * Numbers are <board count> - <tile list count>
 * That is positive numbers are present on the board, but not in the list.
 * Negative numbers are in the list but missing from the board.
 */
export function checkBoardTiles(board: Board): Map<string, number> {
  const tileToCount = new Map();
  for (let r = 0; r < board.getHeight(); r++) {
    for (let c = 0; c < board.getWidth(); c++) {
      const cell = board.getCell(c, r);
      const tile = cell.tileNumber;
      if (tile && tile.length > 0) {
        tileToCount.set(tile, (tileToCount.get(tile) || 0) + 1);
      }
    }
  }

  const tileLists = board.getTileLists();
  _.each(tileLists, ({title, tiles}) => {
    _.each(tiles, tile => {
      tileToCount.set(tile, (tileToCount.get(tile) || 0) - 1);
    });
  });

  return tileToCount;
}

function renderTileListItem(tile: string, count: number) {
  if (count < 2) {
    return tile;
  }
  return `${tile.trim()}(${count})`;
}

export function renderTileListValue(tileList: Array<string>): string {
  const reduced = [];
  let lastTile = null;
  let count = 0;
  tileList.forEach(tile => {
    if (tile !== lastTile) {
      if (lastTile !== null) {
        reduced.push(renderTileListItem(lastTile, count));
      }
      lastTile = tile;
      count = 1;
    } else {
      count++;
    }
  });
  if (lastTile) {
    reduced.push(renderTileListItem(lastTile, count));
  }

  return reduced.join(', ');
}
