/* @flow */

import google from 'googleapis';
const sheets = google.sheets('v4');

export function genBatchUpdate(
  auth: any,
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

export function genSpreadsheets(
  auth: any,
  spreadsheetId: string,
  range: ?string,
  includeGridData: ?bool,
): Promise<any> {
  includeGridData = includeGridData || false;
  let rangeParams = range ? {ranges: [range]} : {};
  return new Promise((resolve, reject) => {
    sheets.spreadsheets.get({
      auth,
      spreadsheetId,
      includeGridData,
      ...rangeParams,
    }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}
