'use strict';
/* @flow */

const config = {
  entry: './entry.js',
  output: {
    path: __dirname + '/build/',
    filename: 'bundle.js',
  },
  devtool: 'eval-source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env'],
            plugins: [
              'transform-flow-strip-types',
              'babel-plugin-transform-class-properties',
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      }
    ],
  },
};

module.exports = config;
