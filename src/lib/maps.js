/* @flow */

export function filenameFromMapName(mapName: string): string {
  return baseFilenameFromMapName(mapName)
    .concat('.json');
}

export function baseFilenameFromMapName(mapName: string): string {
  return mapName
    .toLowerCase()
    .replace(/ /g, '_')
    .replace(/[^a-z_]/g, '');
}
