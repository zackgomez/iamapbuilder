'use strict'
/* @flow */

const config = {
  entry: './entry.js',
  output: {
    path: __dirname + '/build/',
    filename: 'bundle.js',
  },
  module: {
    rules: [
    {
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['env'],
          plugins: ['transform-flow-strip-types', 'babel-plugin-transform-class-properties'],
        }
      }
    }
    ]
  }

};

module.exports = config;
