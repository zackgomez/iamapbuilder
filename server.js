/* @flow */

import express from 'express';
import fs from 'mz/fs';

import config from './webpack.config.js';
const compiler = require('webpack')(config);

let app = express();

const router = require('express-promise-router')();

app.use(express.static('public'));
app.use('/build', express.static('build'));

app.set('port', process.env.PORT || 3000);
app.set('host', process.env.HOST || '0.0.0.0');

app.use('/', router);

router.get('/map/:index', async (req, res) => {
  const indexContent = await fs.readFile('map_index.json');
  const mapList = JSON.parse(indexContent);
  const index = req.params.index;

  if (index >= mapList.length) {
    res.status(400).send('bad index');
    return;
  }

  const map = mapList[index];
  const filename = map.toLowerCase().replace(/ /g, '_').replace(/[^a-z_]/g, '') + '.json';


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

app.listen(app.get('port'), app.get('host'));
