/* @flow */

import fs from 'mz/fs';
import readline from 'mz/readline';
import google from 'googleapis';
import googleAuth from 'google-auth-library';

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
var TOKEN_DIR =
  // $FlowFixMe
  (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +
  '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

export async function genAuth(): Promise<any> {
  const contents = await fs.readFile('client_secret.json');
  const credentials = JSON.parse(contents);

  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  try {
    const token = await fs.readFile(TOKEN_PATH);
    oauth2Client.credentials = JSON.parse(token);
    return oauth2Client;
  } catch (e) {
    return await getNewToken(oauth2Client);
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 */
async function getNewToken(oauth2Client): Promise<any> {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const code = await rl.question('Enter the code from that page here: ');
  rl.close();
  const token = await oauth2Client.getToken(code);
  oauth2Client.credentials = token;
  await storeToken(token);
  return oauth2Client;
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
async function storeToken(token): Promise<void> {
  try {
    await fs.mkdir(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}
