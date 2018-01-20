/* @flow */
import _ from 'lodash';
import invariant from 'invariant';
import nullthrows from 'nullthrows';

import Board from './board';
import fs from 'mz/fs';
import readline from 'mz/readline';

type State = {
  filename: ?string,
  board: ?Board,
}
let state : State = {
  filename: null,
  board: null,
};

async function getFilename(rl: readline.Interface): Promise<string> {
  if (process.argv.length === 3) {
    return process.argv[2];
  }

  throw new Error('Missing filename');
}

async function handleLine(rl: readline, line: string): Promise<void> {
  let {board} = state;

  line = line.trim();
  if (line.startsWith('list')) {
    board = nullthrows(board);
    console.log(board.getTileLists());
  } else if (line.startsWith('add')) {
    board = nullthrows(board);

    const title = await rl.question('Tile Set: ');
    const tilesString = await rl.question('Tiles (space separated): ');
    const tiles = tilesString.trim().replace(/,/, '').split(' ');
    board.addTileList({title, tiles});
    console.log(board.getTileLists());
  } else if (line.startsWith('save')) {
    board = nullthrows(board);
    await fs.writeFile(state.filename, board.serialize());
  } else if (line.startsWith('check')) {
    board = nullthrows(board);
    const tileToCount = new Map();
    for (let r = 0; r < board.getHeight(); r++) {
      for (let c = 0; c < board.getWidth(); c++) {
        const cell = board.getCell(c, r);
        const tile = cell.tileNumber
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
    console.log(tileToCount);
  } else if (line.startsWith('exit')) {
    process.exit(0);
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const filename = await getFilename(rl);
  state.filename = filename;

  const data = await fs.readFile(filename);
  state.board = Board.fromSerialized(data);

  rl.prompt();
  rl.on('line', async line => {
    try {
      await handleLine(rl, line);
    } catch (e) {
      console.error(e);
    }
    rl.prompt();
  });
  rl.on('close', () => {
    process.exit(0);
  });
}

main().catch(e => {
  console.error(e);
  process.exit(-1);
});
