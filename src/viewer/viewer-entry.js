/* @flow */

import nullthrows from 'nullthrows';
import React from 'react';
import ReactDOM from 'react-dom';
import MapViewerApp from './viewer';
import ApolloClient from 'apollo-boost';

let apolloClient = new ApolloClient({
  uri: 'http://localhost:3000/graphql',
});

ReactDOM.render(
  <MapViewerApp apollo={apolloClient} />,
  nullthrows(document.getElementById('app-container')),
);
