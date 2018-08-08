/* @flow */

import type {MapIndexEntry} from '../lib/MapIndex';

import commander from 'commander';
import fs from 'mz/fs';
import readline from 'mz/readline';
import path from 'path';
import nullthrows from 'nullthrows';

import {drawGridLayer, drawEdgeLayer} from '../lib/CanvasRenderer';
import {genAuth} from './auth';
import {checkBoardTiles, getIndexLocation, getCSSColorForMapType} from '../lib/BoardUtils';
import {
  makeCreateSheetRequest,
  makeUpdateCellsRequest,
  makeUpdateDimensionPropertiesRequests,
  makeUpdateSheetPropertiesRequest,
} from './converter';
import {genBatchUpdate, genSpreadsheets} from './google-api-wrapper';

import Canvas from 'canvas';

import {genEditMode} from './edit_map_tiles';
import {genMapIndex, genWriteMapIndex} from '../lib/MapIndex';
import {convertSheet} from './sheet_to_map';
import {filenameFromMapName, baseFilenameFromMapName} from '../lib/maps';
import * as _ from 'lodash';

import Board from '../lib/board';

async function genBoard(item: MapIndexEntry): Promise<Board> {
  const filename = filenameFromMapName(item.title);
  const content = await fs.readFile(`maps/${filename}`);
  return Board.fromSerialized(content);
}

async function genDownloadSpreadsheetCommand(
  spreadsheetId: string,
  range: string,
  cmd: Object,
): Promise<void> {
  const auth = await genAuth();

  const response = await genSpreadsheets(
    auth,
    spreadsheetId,
    range,
    true, // includeGridData
  );

  const printed = JSON.stringify(response, null, 2);

  const filename = cmd.filepath;
  if (filename) {
    await fs.writeFile(filename, printed);
    console.log(`Wrote response to ${filename}`);
  } else {
    console.log(printed);
  }
}

async function genUploadSpreadsheet(
  spreadsheetId: string,
  mapFilename: string,
  cmd: Object,
): Promise<void> {
  const auth = await genAuth();

  const mapContents = await fs.readFile(mapFilename);
  const map = JSON.parse(mapContents);

  console.log(`Uploading map ${map.name}`);

  let sheetId: ?number = null;
  let requests = [];

  try {
    const response = await genSpreadsheets(auth, spreadsheetId, map.name + '');
    if (response.sheets.length === 1) {
      sheetId = response.sheets[0].properties.sheetId;
      requests.push(makeUpdateSheetPropertiesRequest(sheetId, map));
      console.log('Updating existing sheet', sheetId);
    }
  } catch (e) {}
  if (!sheetId) {
    sheetId = Math.floor(Math.random() * 2147483648);
    requests.push(makeCreateSheetRequest(map, sheetId));
    console.log('Creating new sheet', sheetId);
  }

  requests.push(...makeUpdateDimensionPropertiesRequests(sheetId));
  requests.push(makeUpdateCellsRequest(sheetId, map));

  const response = await genBatchUpdate(auth, spreadsheetId, requests);

  console.log('Successfully updated sheet');
}

async function genShrinkSpreadsheet(spreadsheetId: string, cmd: any): Promise<void> {
  const auth = await genAuth();

  const sheetsResponse = await genSpreadsheets(auth, spreadsheetId);
  const requests = [];
  sheetsResponse.sheets.forEach(sheet => {
    if (sheet.properties.gridProperties.rowCount > 100) {
      const sheetId = sheet.properties.sheetId;
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              rowCount: 100,
            },
          },
          fields: 'gridProperties.rowCount',
        },
      });
    }
  });

  if (requests.length === 0) {
    console.log('No shrinking needed');
    return;
  }
  console.log(`Shrinking ${requests.length} sheets`);

  await genBatchUpdate(auth, spreadsheetId, requests);
}

async function genCreateMap(cmd: any): Promise<void> {
  const board = Board.defaultBoard();
  await genEditMode(null, board, true);
}

async function genEditFile(file: string, cmd: any): Promise<any> {
  const serialized = await fs.readFile(file);
  const board = Board.fromSerialized(serialized);

  await genEditMode(file, board);
}

async function genConvertSpreadsheet(sheetId: string, cmd: any): Promise<void> {
  const auth = await genAuth();
  const indexContent = await fs.readFile('./maps/map_index.json');
  const titles = JSON.parse(indexContent);

  const start = (cmd.start && parseInt(cmd.start)) || 0;

  for (let i = start; i < titles.length; i++) {
    const title = titles[i];

    console.log(`Converting ${i}/${titles.length} "${title}"`);

    const spreadsheet = await genSpreadsheets(auth, sheetId, title, true);
    const board = convertSheet(spreadsheet.sheets[0]);

    const filename =
      'downloads/' +
      board
        .getName()
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/[^a-z_]/g, '')
        .concat('.json');

    console.log(`Writing ${title} to ${filename}`);
    await fs.writeFile(filename, board.serialize());

    if (cmd.single) {
      break;
    }
  }
}

async function genCompactFile(
  file: string,
  files: ?Array<string>,
  cmd: any,
): Promise<void> {
  let allFiles = [file];
  if (files && files.length > 0) {
    allFiles = allFiles.concat(files);
  }
  for (const file of allFiles) {
    console.log(`Compacting ${file}`);

    const serialized = await fs.readFile(file);
    const board = Board.fromSerialized(serialized);

    const oldSize = board.serialize().length;
    board.applyEdgeRules();
    board.compact();
    const newSize = board.serialize().length;
    console.log(`Compaction saved ${oldSize - newSize} bytes out of ${oldSize}`);

    await fs.writeFile(file, board.serialize());
  }
}

async function genValidateMaps(): Promise<void> {
  const indexContent = await fs.readFile('map_index.json');
  const mapIndex = JSON.parse(indexContent);

  for (const index of mapIndex) {
    const filename = filenameFromMapName(index.title);

    const fileContents = await fs.readFile(`maps/${filename}`);
    const mapData = JSON.parse(fileContents);

    const board = Board.fromSerialized(fileContents);
    if (board.tileLists.length === 0) {
      console.log(`${filename} is missing tile list`);
    }
    const tileCheckResult = checkBoardTiles(board);
    const badTileCheck = _.some(tileCheckResult, (count, tile) => {
      return count !== 0;
    });
    if (badTileCheck) {
      console.log(`${filename} fails tile check`);
    }

    if (!board.getBriefingLocation().match(/\(Wave \d+\)|\(Core Game\)/)) {
      console.log(`${filename} has bad wave in location ${board.getBriefingLocation()}`);
    }
    // TODO more validation
  }
}

async function genRefreshIndex(): Promise<void> {
  const mapIndex = await genMapIndex();

  const updatedMapIndex = await Promise.all(mapIndex.map(async (item: MapIndexEntry) => {
    const filename = filenameFromMapName(item.title);
    const content = await fs.readFile(`maps/${filename}`);
    const board = Board.fromSerialized(content);

    return {
      index: item.index,
      title: board.getName(),
      location: board.getBriefingLocation(),
      type: board.getMapType(),
    };
  }));

  const changedItems = updatedMapIndex.filter((updatedItem, i) => {
    const oldItem = mapIndex[i];
    return !_.isEqual(oldItem, updatedItem);
  });

  await genWriteMapIndex(updatedMapIndex);

  console.log(changedItems);
}

async function genRenderMap(files: Array<string>, cmd: any): Promise<void> {
  const format = cmd.format;

  const PADDING = 5;
  const SCALE = !isNaN(cmd.scale) && cmd.scale > 0 ? cmd.scale : 50;
  const ZOOM = 1;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const content = await fs.readFile(file);
    const board = Board.fromSerialized(content);
    const width = ZOOM * (board.getWidth() * SCALE + 2 * PADDING);
    const height = ZOOM * (board.getHeight() * SCALE + 2 * PADDING);

    const canvas = new Canvas(width, height, format === 'png' ? null : format);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    ctx.scale(ZOOM, ZOOM);

    ctx.translate(PADDING, PADDING);

    drawGridLayer(ctx, board, SCALE);
    drawEdgeLayer(ctx, board, SCALE);

    let outputFile = ((cmd.output : ?string) || null);

    let outStream;
    if (outputFile) {
      try {
        const stats = await fs.stat(outputFile);
        if (stats.isDirectory()) {
          outputFile = path.format({
            root: outputFile,
            name: path.basename(file, '.json'),
            ext: '.'+format,
          });
        }
      } catch (e) {
        console.log(e);
        throw e;
      }
      outStream = fs.createWriteStream(outputFile);
    } else {
      outStream = process.stdout;
    }

    if (format === 'png') {
      const pngStream = canvas.pngStream();
      pngStream.on('data', chunk => {
        outStream.write(chunk);
      });
      pngStream.on('end', () => {
        if (outputFile !== null) {
          console.log(`wrote to ${outputFile}`);
        }
      });
    } else if (format === 'svg' || format === 'pdf') {
      outStream.write(canvas.toBuffer());
    }
  }
}

async function genWriteViewerData(cmd: any): Promise<void> {
  const mapIndex = await genMapIndex();

  const viewerData = await Promise.all(mapIndex.map(async (item) => {
    const board = await genBoard(item);
    return {
      index: item.index,
      title: item.title,
      location: item.location,
      type: item.type,
      renderURL: `renders/${baseFilenameFromMapName(item.title)}.svg`,
      indexLocation: getIndexLocation(item.location),
      color: getCSSColorForMapType(item.type),
      tileLists: board.getTileLists(),
    }
  }));

  process.stdout.write(JSON.stringify(viewerData));
}

function wrapAsyncCommand(asyncCommand) {
  return function(a, b, c, d, e) {
    asyncCommand.apply(null, arguments).catch(e => {
      console.error(e);
      process.exit(1);
    });
  };
}

commander
  .command('download <spreadsheetId> <range>')
  .description('download a spreadsheet')
  .option('-f, --filepath <filepath>', 'output file')
  .action(wrapAsyncCommand(genDownloadSpreadsheetCommand));

commander
  .command('upload <spreadsheetId> <mapFilename>')
  .action(wrapAsyncCommand(genUploadSpreadsheet));

commander
  .command('shrink <spreadsheetId>')
  .action(wrapAsyncCommand(genShrinkSpreadsheet));

commander.command('new').action(wrapAsyncCommand(genCreateMap));

commander.command('edit <file>').action(wrapAsyncCommand(genEditFile));

commander.command('compact <file> [files...]').action(wrapAsyncCommand(genCompactFile));

commander
  .command('convertSpreadsheet <spreadsheetId>')
  .option('-s, --start <index>', 'start index')
  .option('-1, --single', 'only convert 1 sheet')
  .action(wrapAsyncCommand(genConvertSpreadsheet));

commander.command('validate').action(wrapAsyncCommand(genValidateMaps));

commander
  .command('refreshIndex')
  .action(wrapAsyncCommand(genRefreshIndex))

commander
  .command('render [files...]')
  .description('render the map to an image, default png')
  .option('-o, --output <file>', 'output file')
  .option('-s, --scale <number>', 'cell scale size', parseInt)
  .option('--format <format>', 'output format png,svg,pdf', /^(png|svg|pdf)$/i, 'png')
  .action(wrapAsyncCommand(genRenderMap))

commander
  .command('generateViewerData')
  .action(wrapAsyncCommand(genWriteViewerData));

commander.parse(process.argv);

if (!process.argv.slice(2).length) {
  commander.outputHelp();
}
