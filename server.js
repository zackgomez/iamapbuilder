/* @flow */

import express from 'express';
import bodyParser from 'body-parser';
import fs from 'mz/fs';

import Board from './board';

import config from './webpack.config.js';
const compiler = require('webpack')(config);

let app = express();

const router = require('express-promise-router')();

app.use(bodyParser.json());

app.use(express.static('public'));
app.use('/build', express.static('build'));

app.set('port', process.env.PORT || 3000);
app.set('host', process.env.HOST || '0.0.0.0');

app.use('/', router);

async function genMapFilenameFromIndex(index: number): Promise<string> {
  const indexContent = await fs.readFile('map_index.json');
  const mapList = JSON.parse(indexContent);

  if (index >= mapList.length) {
    throw new RangeError('Index out of bounds');
  }

  const map = mapList[index];
  return map.toLowerCase().replace(/ /g, '_').replace(/[^a-z_]/g, '') + '.json';
}

router.get('/map/:index', async (req, res) => {
  const index = parseInt(req.params.index);
  const filename = await genMapFilenameFromIndex(index);

  const options = {
    root: __dirname + '/maps/',
    dotfiles: 'deny',
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  };
  res.sendFile(filename, options);
})

router.post('/map/:index', async (req, res) => {
  const index = parseInt(req.params.index);

  const filename = await genMapFilenameFromIndex(index);
  const path = 'maps/' + filename;

  console.log(req.body.serialized);

  const existingData = await fs.readFile(path);
  const existingBoard = Board.fromSerialized(existingData);

  const newData = req.body.serialized;
  const newBoard = Board.fromSerialized(newData);

  if (newBoard.getName() !== existingBoard.getName()) {
    throw new Error('name change not implemented');
  }

  newBoard.compact();
  fs.writeFile(path, newBoard.serialize());

  res.send('success');
  res.end();
});

app.listen(app.get('port'), app.get('host'));
