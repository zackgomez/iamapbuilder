/* @flow */
import commander from 'commander';
import fs from 'mz/fs';
import readline from 'mz/readline';

import {genAuth} from './auth';
import {
  makeCreateSheetRequest,
  makeUpdateCellsRequest,
  makeUpdateDimensionPropertiesRequests,
  makeUpdateSheetPropertiesRequest,
} from './converter';
import {
  genBatchUpdate,
  genSpreadsheets,
} from './google-api-wrapper';

import { genEditMode } from './edit_map_tiles';
import { convertSheet } from './sheet_to_map';

import Board from './board';

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
  } catch (e) {
  }
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

async function genShrinkSpreadsheet(
  spreadsheetId: string,
  cmd: any,
): Promise<void> {
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

async function genCreateMap(
  cmd: any,
): Promise<void> {
  const board = Board.defaultBoard();
  await genEditMode(null, board);
}

async function genEditFile(
  file: string,
  cmd: any,
): Promise<any> {
  const serialized = await fs.readFile(file);
  const board = Board.fromSerialized(serialized);

  await genEditMode(file, board);
}

async function genConvertSpreadsheet(
  sheetId: string,
  cmd: any,
): Promise<void> {
  const auth = await genAuth();
  const indexContent = await fs.readFile('./maps/map_index.json');
  const titles = JSON.parse(indexContent);

  const start = (cmd.start && parseInt(cmd.start)) || 0;

  for (let i = start; i < titles.length; i++) {
    const title = titles[i];

    console.log(`Converting ${i}/${titles.length} "${title}"`);

    const spreadsheet = await genSpreadsheets(auth, sheetId, title, true);
    const board = convertSheet(spreadsheet.sheets[0]);

    const filename = 'downloads/' + board.getName()
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

commander
  .command('new')
  .action(wrapAsyncCommand(genCreateMap));

commander
  .command('edit <file>')
  .action(wrapAsyncCommand(genEditFile));

commander
  .command('convertSpreadsheet <spreadsheetId>')
  .option('-s, --start <index>', 'start index')
  .option('-1, --single', 'only convert 1 sheet')
  .action(wrapAsyncCommand(genConvertSpreadsheet));

commander.parse(process.argv);
