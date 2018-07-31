/* @flow */

import fs from 'mz/fs';

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
