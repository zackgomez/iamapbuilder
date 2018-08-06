/* @flow */

import fs from 'mz/fs';
import _ from 'lodash';

import {filenameFromMapName} from './maps';

const MAP_INDEX_PATH = 'map_index.json';

export type MapIndexEntry = {
  index: number,
  title: string,
  type: string,
  location: string,
};

export async function genMapIndex(): Promise<Array<MapIndexEntry>> {
  const indexContent = await fs.readFile(MAP_INDEX_PATH);
  const mapIndex = JSON.parse(indexContent);
  mapIndex.forEach((item, i) => item.index = i);
  return mapIndex;
}


export async function genWriteMapIndex(newMapIndex: Array<MapIndexEntry>) {
  const trimmedMapIndex = _.clone(newMapIndex);
  trimmedMapIndex.forEach(entry => {
    delete entry.index;
  })
  const serializedMapIndex = JSON.stringify(trimmedMapIndex);

  await fs.writeFile(MAP_INDEX_PATH, serializedMapIndex);
  console.log(`wrote ${MAP_INDEX_PATH}`)
}
