/* @flow */

'use strict';

const USE_EDITOR = false;
if (USE_EDITOR) {
  import(/* webpackChunkName: "editor" */ './editor-entry.js');
} else {
  import('./viewer-entry.js');
}
