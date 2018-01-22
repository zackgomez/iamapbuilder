/* @flow */
import commander from 'commander';
import fs from 'mz/fs';
import readline from 'mz/readline';
import google from 'googleapis';

import {genAuth} from './auth';
import {
  makeCreateSheetRequest,
  makeUpdateCellsRequest,
  makeUpdateDimensionPropertiesRequests,
  makeUpdateSheetPropertiesRequest,
} from './converter';

import Board from './board';

function genBatchUpdate(
  auth,
  sheets,
  spreadsheetId: string,
  requests: Array<any>,
): Promise<any> {
  return new Promise((resolve, reject) => {
    sheets.spreadsheets.batchUpdate({
      auth,
      spreadsheetId,
      resource: {requests},
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function genSpreadsheets(
  auth,
  sheets,
  spreadsheetId: string,
  range: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    sheets.spreadsheets.get({
      auth,
      spreadsheetId,
      ranges: [range],
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

async function downloadSpreadsheetCommand(
  spreadsheetId: string, 
  range: string,
  cmd: Object,
): Promise<void> {
  const auth = await genAuth();

  // TODO
}

async function genUploadSpreadsheet(
  spreadsheetId: string, 
  mapFilename: string,
  cmd: Object,
): Promise<void> {
  const auth = await genAuth();

  const mapContents = await fs.readFile(mapFilename);
  const map = JSON.parse(mapContents);

  const sheets = google.sheets('v4');

  let sheetId: ?number = null;
  let requests = [];

  try {
    const response = await genSpreadsheets(auth, sheets, spreadsheetId, map.name + '');
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

  const response = await genBatchUpdate(auth, sheets, spreadsheetId, requests);

  console.log(response);
}

function wrapAsyncCommand(asyncCommand) {
  return function() {
    asyncCommand.apply(null, arguments).catch(e => {
      console.error(e);
      process.exit(1);
    });
  };
}

commander
  .command('download <spreadsheetId> <range>')
  .action(wrapAsyncCommand(downloadSpreadsheetCommand));

commander
  .command('upload <spreadsheetId> <mapFilename>')
  .action(wrapAsyncCommand(genUploadSpreadsheet));

commander.parse(process.argv);
