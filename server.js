/* @flow */

import express from 'express';
import bodyParser from 'body-parser';
import fs from 'mz/fs';

import Board from './board';

import {filenameFromMapName} from './maps';

let app = express();

const router = require('express-promise-router')();

app.use(bodyParser.json());

app.use(express.static('public'));
app.use('/build', express.static('build'));

app.set('port', process.env.PORT || 3000);
app.set('host', process.env.HOST || '0.0.0.0');

app.use('/', router);

const MAP_INDEX_PATH = 'map_index.json';

async function genMapFilenameFromIndex(index: number): Promise<string> {
  const indexContent = await fs.readFile(MAP_INDEX_PATH);
  const mapList = JSON.parse(indexContent);

  if (index >= mapList.length) {
    throw new RangeError('Index out of bounds');
  }

  const item = mapList[index];
  const map = item.title;
  return filenameFromMapName(map);
}

router.get('/map/list', async (req, res) => {
  res.sendFile(__dirname + '/' + MAP_INDEX_PATH);
});

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
