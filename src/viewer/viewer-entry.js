/* @flow */

import nullthrows from 'nullthrows';
import React from 'react';
import ReactDOM from 'react-dom';
import MapViewerApp from './viewer';

ReactDOM.render(
  <MapViewerApp />,
  nullthrows(document.getElementById('app-container')),
);
