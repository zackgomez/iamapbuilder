/* @flow */

import type {MapIndexEntry} from './MapIndex';

import {gql} from 'apollo-server';
import nullthrows from 'nullthrows';

import fs from 'mz/fs';
import Board from './board';
import {genMapIndex, genMapFilenameFromIndex} from './MapIndex';
import {filenameFromMapName} from './maps';

export const typeDefs = gql`
  type MapDefinition {
    index: Int
    title: String
    type: String
    location: String
    index_location: String
    data: String
    color: String
  }

  type MapSearchResult {
    results: [MapDefinition]!
  }

  type Query {
    map(index: Int!): MapDefinition
    map_list: [MapDefinition]!
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
      const mapIndex = await genMapIndex();
      return mapIndex[index];
    },
    map_list: async (_: mixed) => {
      return await genMapIndex();
    },
    map_search: async (_: mixed, {title}: {title: string}) => {
      const mapIndex = await genMapIndex();
      const results = mapIndex.filter(entry => {
        let matches
        return entry.title.match(title);
      });
      return {
        results,
      };
    },
  },
  MapDefinition: {
    data: async (parent: MapIndexEntry) => {
      const filename = filenameFromMapName(parent.title);
      return await fs.readFile(__dirname + '/maps/' + filename);
    },
    color: (parent: MapIndexEntry) => {
      const type = parent.type.toLowerCase();
      if (type.startsWith('red')) {
        return 'rgb(255, 0, 0)';
      } else if (type.startsWith('gray')) {
        return 'rgb(127, 127, 127)';
      } else if (type.startsWith('green')) {
        return 'rgb(0, 176, 80)';
      } else if (type.startsWith('agenda')) {
        return 'rgb(31, 73, 126)';
      }
      return 'rgb(0, 0, 0)';
    },
    index_location: async (parent: MapIndexEntry) => {
      return parent.location;
    },
  },
  Mutation: {
    update_map: async (_: mixed, {index, data}: {index: number, data: string}) => {
      const mapIndex = await genMapIndex();
      const indexItem = nullthrows(mapIndex[index]);

      const filename =  filenameFromMapName(indexItem.title);
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
