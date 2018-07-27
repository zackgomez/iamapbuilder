/* @flow */
import _ from 'lodash';
import invariant from 'invariant';
import nullthrows from 'nullthrows';

import Board from './board';
import fs from 'mz/fs';
import readline from 'mz/readline';
import {checkBoardTiles} from './BoardUtils';
import {TileSets, MissionTypes, BriefingLocations} from './GameData';

type State = {
  filename: ?string,
  board: ?Board,
};
let state: State = {
  filename: null,
  board: null,
};

async function getFilename(rl: readline.Interface): Promise<string> {
  if (process.argv.length === 3) {
    return process.argv[2];
  }

  throw new Error('Missing filename');
}

type CompletionResult = [Array<string>, string];
type AsyncCompleter = (line: string) => Promise<CompletionResult>;

let completerStack: Array<AsyncCompleter> = [];

function pushCompleter(newCompleter: AsyncCompleter): void {
  completerStack.push(newCompleter);
}
function popCompleter(): void {
  completerStack.pop();
}
function clearCompleters() {
  completerStack = [];
}

function completer(
  line: string,
  callback: (err: ?Error, result: ?[Array<string>, string]) => void,
): void {
  if (completerStack.length === 0) {
    callback(null, [[], line]);
    return;
  }
  const current = completerStack[completerStack.length - 1];
  current(line)
    .then(result => callback(null, result))
    .catch(err => callback(err, null));
}

function makeCompleter(candidates: Array<string>): AsyncCompleter {
  return async (line: string) => {
    const matches = candidates.filter(set => set.startsWith(line));
    if (matches.length) {
      return [matches, line];
    }
    return [[], line];
  };
}
const TileSetCompleter = makeCompleter(TileSets);
const MissionTypeCompleter = makeCompleter(MissionTypes);
const BriefingLocationCompleter = makeCompleter(BriefingLocations);

async function questionWithCompleter(
  rl: readline,
  completer: AsyncCompleter,
  question: string,
): Promise<string> {
  pushCompleter(completer);
  try {
    return await rl.question(question);
  } finally {
    popCompleter();
  }
}

async function handleLine(rl: readline, line: string): Promise<void> {
  let {board} = state;
  board = nullthrows(board);

  line = line.trim();
  if (line.startsWith('list')) {
    console.log(board.getTileLists());
  } else if (line.startsWith('addtiles')) {
    const title = await questionWithCompleter(rl, TileSetCompleter, 'Tile Set: ');

    const tilesString = await rl.question('Tiles (space separated): ');
    const tiles = tilesString
      .trim()
      .replace(/,/, '')
      .split(' ');
    board.addTileList({title, tiles});
    console.log(board.getTileLists());
  } else if (line.startsWith('save')) {
    let filename: ?string = state.filename;
    if (!filename || filename.length === 0) {
      filename = await rl.question('Save as? ');
      if (!filename.endsWith('.json')) {
        filename = filename + '.json';
      }
    }
    await fs.writeFile(filename, board.serialize());
    state.filename = filename;
    console.log(`Saved to ${filename}`);
  } else if (line.startsWith('check')) {
    const tileToCount = checkBoardTiles(board);
    console.log(tileToCount);
  } else if (line.startsWith('exit')) {
    process.exit(0);
  } else if (line.startsWith('name')) {
    const name = await rl.question('New Mission Name: ');
    board.setName(name);
  } else if (line.startsWith('location')) {
    const location = await questionWithCompleter(
      rl,
      BriefingLocationCompleter,
      'Briefing Location: ',
    );
    board.setBriefingLocation(location);
  } else if (line.startsWith('type')) {
    const type = await questionWithCompleter(rl, MissionTypeCompleter, 'Mission Type: ');
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
  } else if (line.startsWith('shrink')) {
    let lastX = board.getWidth() - 1;
    for (; lastX >= 0; lastX--) {
      let hit = false;
      for (let y = 0; y < board.getHeight(); y++) {
        if (board.getCell(lastX, y).inBounds) {
          hit = true;
          break;
        }
      }
      if (hit) {
        break;
      }
    }
    let lastY = board.getHeight() - 1;
    for (; lastY >= 0; lastY--) {
      let hit = false;
      for (let x = 0; x <= lastX; x++) {
        if (board.getCell(x, lastY).inBounds) {
          hit = true;
          break;
        }
      }
      if (hit) {
        break;
      }
    }

    const newWidth = lastX + 1;
    const newHeight = lastY + 1;

    const answer = await rl.question(
      `Go from size ${board.getWidth()} x ${board.getHeight()} to ${newWidth} x ${newHeight}? (y/n)`,
    );
    if (answer === 'y') {
      board.setWidth(newWidth);
      board.setHeight(newHeight);
      console.log('Shrank board');
    } else {
      console.log('Not shrinking');
    }
  } else if (line.startsWith('compact')) {
    const oldSize = board.serialize().length;
    board.applyEdgeRules();
    board.compact();
    const newSize = board.serialize().length;
    console.log(`Compaction saved ${oldSize - newSize} bytes out of ${oldSize}`);
  } else {
    console.log(`unknown command '${line}'`);
  }
}

export async function genEditMode(filename: ?string, board: Board): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  });

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
