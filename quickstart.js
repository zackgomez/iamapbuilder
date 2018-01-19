var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var {makeUpdateCellsRequest} = require('./converter.js');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
var TOKEN_DIR =
  (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +
  '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Google Sheets API.
  authorize(JSON.parse(content), onAuth);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Print the names and majors of students in a sample spreadsheet:
 * https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 */
function listMajors(auth) {
  var sheets = google.sheets('v4');
  sheets.spreadsheets.get(
    {
      auth: auth,
      spreadsheetId: '1_tetSsXQLlTHUBqXQNJYbOjB25oCkzzYg7NNkMMwEbo', //'1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      ranges: 'Armed and Operational',
      includeGridData: true,
    },
    function(err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      console.log(response);
      console.log(response.sheets[0]);
      console.log(response.sheets[0].data);

      fs.writeFileSync('response.json', JSON.stringify(response, null, 4));
    },
  );
}

function makeUpdateDimensionPropertiesRequest(sheetId, dimension, pixelSize) {
  return {
    range: {
      sheetId,
      dimension,
    },
    properties: {
      pixelSize,
    },
    fields: 'pixelSize',
  };
}

function makeUpdateDimensionPropertiesRequests(sheetId) {
  return [
    {
      updateDimensionProperties: makeUpdateDimensionPropertiesRequest(
        sheetId,
        'COLUMNS',
        29,
      ),
    },
    {
      updateDimensionProperties: makeUpdateDimensionPropertiesRequest(
        sheetId,
        'ROWS',
        30,
      ),
    },
  ];
}

const SPREADSHEET_ID = '1_tetSsXQLlTHUBqXQNJYbOjB25oCkzzYg7NNkMMwEbo';
const SHEET_ID = '670131681';

function uploadMap(auth) {
  var sheets = google.sheets('v4');

  fs.readFile('maps/jabbas_1_trespass.json', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    const map = JSON.parse(data);

    const updateCells = makeUpdateCellsRequest(SHEET_ID, map);
    fs.writeFile('update.json', JSON.stringify(updateCells, null, 2));
    let requests = [{updateCells}];

    requests = requests.concat(makeUpdateDimensionPropertiesRequests(SHEET_ID));

    sheets.spreadsheets.batchUpdate(
      {
        auth,
        spreadsheetId: SPREADSHEET_ID,
        resource: {requests},
      },
      (err, response) => {
        if (err) {
          console.log(err);
          return;
        }
        console.log(response);
      },
    );
  });
}

function dumpSheets(auth) {
  var sheets = google.sheets('v4');
  sheets.spreadsheets.get(
    {
      auth,
      spreadsheetId: SPREADSHEET_ID,
    },
    (err, response) => {
      if (err) {
        console.error(err);
        return;
      }
      fs.writeFile('response.json', JSON.stringify(response, null, 2));
    },
  );
}

function shrinkSheets(auth) {
  var sheets = google.sheets('v4');
  sheets.spreadsheets.get(
    {
      auth,
      spreadsheetId: SPREADSHEET_ID,
    },
    (err, response) => {
      if (err) {
        console.error(err);
        return;
      }
      let requests = [];
      response.sheets.forEach(sheet => {
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

      //fs.writeFile('requests.json', JSON.stringify(requests, null, 2));
      //return;

      sheets.spreadsheets.batchUpdate(
        {
          auth,
          spreadsheetId: SPREADSHEET_ID,
          resource: {requests},
        },
        (err, response) => {
          if (err) {
            console.error(err);
            return;
          }

          console.log(response);
        },
      );
    },
  );
}

function onAuth(auth) {
  //listMajors(auth);
  uploadMap(auth);
}
