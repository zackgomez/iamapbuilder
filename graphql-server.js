/* @flow */

import express from 'express';

import {ApolloServer} from 'apollo-server';
import {registerServer} from 'apollo-server-express';
import {typeDefs, resolvers} from './schema';

let app = express();

app.set('port', process.env.PORT || 3000);
app.set('host', process.env.HOST || '0.0.0.0');

app.use(express.static('public'));
app.use('/build', express.static('build'));

const server = new ApolloServer({
  // These will be defined for both new or existing servers
  typeDefs,
  resolvers,
  formatError: error => {
    console.error(error);
    console.error(error.extensions.exception);
    return error;
  },
});

registerServer({server, app});

app.listen(app.get('port'), app.get('host'));
