/* @flow */

import type { MapIndexEntry } from '../lib/MapIndex';

import { gql } from 'apollo-server';
import nullthrows from 'nullthrows';

import fs from 'mz/fs';
import Board from '../lib/board';
import { getCSSColorForMapType, getIndexLocation } from '../lib/BoardUtils';
import { genMapIndex } from '../lib/MapIndex';
import { filenameFromMapName, baseFilenameFromMapName } from '../lib/maps';

export const typeDefs = gql`
  type MapDefinition {
    index: Int
    title: String
    type: String
    location: String
    index_location: String
    data: String
    color: String
    render_url: String
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
    map: async (_: mixed, { index }: { index: number }) => {
      const mapIndex = await genMapIndex();
      return mapIndex[index];
    },
    map_list: async (_: mixed) => {
      return await genMapIndex();
    },
    map_search: async (_: mixed, { title }: { title: string }) => {
      const mapIndex = await genMapIndex();
      const results = mapIndex.filter(entry => {
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
      return await fs.readFile('maps/' + filename);
    },
    color: (parent: MapIndexEntry) => {
      return getCSSColorForMapType(parent.type);
    },
    index_location: async (parent: MapIndexEntry) => {
      return getIndexLocation(parent.location);
    },
    render_url: async (parent: MapIndexEntry) => {
      return `renders/${baseFilenameFromMapName(parent.title)}.svg`;
    },
  },
  Mutation: {
    update_map: async (
      _: mixed,
      { index, data }: { index: number, data: string },
    ) => {
      const mapIndex = await genMapIndex();
      const indexItem = nullthrows(mapIndex[index]);

      const filename = filenameFromMapName(indexItem.title);
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
    create_map: async (_: mixed, { data }: { data: string }) => {
      return {
        success: false,
      };
    },
  },
};
