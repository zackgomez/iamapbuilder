/* @flow */

import {gql} from 'apollo-server';

import fs from 'mz/fs';
import Board from './board';
import {filenameFromMapName} from './maps';

const MAP_INDEX_PATH = 'map_index.json';
async function genMapFilenameFromIndex(index: number): Promise<string> {
  const indexContent = await fs.readFile(MAP_INDEX_PATH);
  const mapList = JSON.parse(indexContent);

  if (index >= mapList.length) {
    throw new RangeError('Index out of bounds');
  }

  const item = mapList[index];
  const map = item.title;
  return filenameFromMapName(map);
}

type MapIndexEntry = {
  index: number,
  title: string,
  type: string,
  location: string,
};

async function genMapIndex(): Promise<Array<MapIndexEntry>> {
  const indexContent = await fs.readFile(MAP_INDEX_PATH);
  const mapIndex = JSON.parse(indexContent);
  mapIndex.forEach((item, i) => item.index = i);
  return mapIndex;
}

export const typeDefs = gql`
  type MapDefinition {
    index: Int
    title: String
    data: String
  }

  type MapSearchResult {
    results: [MapDefinition]!
  }

  type Query {
    map(index: Int!): MapDefinition
    map_search(title: String): MapSearchResult
  }

  type UpdateMapResponse {
    success: Boolean
    map: MapDefinition
  }

  type CreateMapReponse {
    success: Boolean
    index: Int
    map: MapDefinition
  }

  type Mutation {
    update_map(index: Int!, data: String!): UpdateMapResponse
    create_map(data: String!): CreateMapReponse
  }
`;

export const resolvers = {
  Query: {
    map: async (_: mixed, {index}: {index: number}) => {
      const filename = await genMapFilenameFromIndex(index);

      const contents = fs.readFile(__dirname + '/maps/' + filename);
      return {
        index,
        data: contents,
      };
    },
    map_search: async (_: mixed, {title}: {title: string}) => {
      const mapIndex = await genMapIndex();
      const indexEntryPairs: Array<[number, MapIndexEntry]> = [];
      const results = mapIndex.filter(entry => {
        let matches
        return entry.title.match(title);
      });
      return {
        results,
      };
    },
  },
  Mutation: {
    update_map: async (_: mixed, {index, data}: {index: number, data: string}) => {
      const filename = await genMapFilenameFromIndex(index);
      const path = 'maps/' + filename;

      const existingData = await fs.readFile(path);
      const existingBoard = Board.fromSerialized(existingData);

      const newBoard = Board.fromSerialized(data);

      if (newBoard.getName() !== existingBoard.getName()) {
        throw new Error('name change not implemented');
      }

      newBoard.compact();
      const newData = newBoard.serialize();
      fs.writeFile(path, newData);

      return {
        success: true,
        map: {
          index,
          data: newData,
        },
      };
    },
    create_map: async (_: mixed, {data}: {data: string}) => {
      return {
        success: false,
      }
    },
  },
};
