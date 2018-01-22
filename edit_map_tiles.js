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
  board = nullthrows(board);

  line = line.trim();
  if (line.startsWith('list')) {
    console.log(board.getTileLists());
  } else if (line.startsWith('addtiles')) {
    const title = await rl.question('Tile Set: ');
    const tilesString = await rl.question('Tiles (space separated): ');
    const tiles = tilesString.trim().replace(/,/, '').split(' ');
    board.addTileList({title, tiles});
    console.log(board.getTileLists());
  } else if (line.startsWith('save')) {
    let filename = state.filename;
    if (!filename || filename.length === 0) {
      filename = await rl.question('Save as?');
    }
    await fs.writeFile(filename, board.serialize());
    state.filename = filename;
  } else if (line.startsWith('check')) {
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
  } else if (line.startsWith('name')) {
    const name = await rl.question('New Mission Name: ');
    board.setName(name);
  } else if (line.startsWith('location')) {
    const location = await rl.question('Briefing Location: ');
    board.setBriefingLocation(location);
  } else if (line.startsWith('type')) {
    const type = await rl.question('Mission Type: ');
    board.setMapType(type);
  } else if (line.startsWith('info')) {
    console.log({
      name: board.getName(),
      type: board.getMapType(),
      briefingLocation: board.getBriefingLocation(),
      tiles: board.getTileLists(),
      height: board.getHeight(),
      width: board.getWidth(),
    });
  } else {
    console.log(`unknown command '${line}'`);
  }
}

export async function genEditMode(rl: readline, filename: ?string, board: Board): Promise<void> {
  state.filename = filename;
  state.board = board;

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

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const filename = await getFilename(rl);
  const data = await fs.readFile(filename);

  await genEditMode(rl, filename, Board.fromSerialized(data));
}

/*
main().catch(e => {
  console.error(e);
  process.exit(-1);
});
*/
