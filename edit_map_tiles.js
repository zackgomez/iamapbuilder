/* @flow */
import _ from 'lodash';
import invariant from 'invariant';
import nullthrows from 'nullthrows';

import Board from './board';
import fs from 'mz/fs';
import readline from 'mz/readline';
import {checkBoardTiles} from './BoardUtils';
import {TileSets} from './GameData';

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

type CompletionResult = [Array<string>, string];
type AsyncCompleter = (line: string) => Promise<CompletionResult>;

let completerStack : Array<AsyncCompleter> = [];

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

async function tileSetCompleter(line: string): Promise<CompletionResult> {
  const matches = TileSets.filter(set => set.startsWith(line));
  return [matches.length ? matches : TileSets, line];
}

async function handleLine(rl: readline, line: string): Promise<void> {
  let {board} = state;
  board = nullthrows(board);

  line = line.trim();
  if (line.startsWith('list')) {
    console.log(board.getTileLists());
  } else if (line.startsWith('addtiles')) {

    pushCompleter(tileSetCompleter);
    const title = await rl.question('Tile Set: ');
    popCompleter(completer);

    const tilesString = await rl.question('Tiles (space separated): ');
    const tiles = tilesString.trim().replace(/,/, '').split(' ');
    board.addTileList({title, tiles});
    console.log(board.getTileLists());
  } else if (line.startsWith('save')) {
    let filename : ?string = state.filename;
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
