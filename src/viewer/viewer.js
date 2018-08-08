/* @flow */

import React from 'react';
import {Fragment} from 'react';
import ReactDom from 'react-dom';
import ApolloClient from 'apollo-boost';
import gql from 'graphql-tag';
import nullthrows from 'nullthrows';
import classNames from 'classnames';

import Board from '../lib/board';
import {renderTileListValue} from '../lib/BoardUtils';

import styles from '../../css/viewer.css';

type IndexItem = {
  index: number,
  title: string,
  location: string,
  type: string,
  color: string,
  index_location: string,
};

type Props = {
  apollo: ApolloClient,
};
type State = {
  error?: Error,
  index?: Array<IndexItem>,
  searchText: string,

  selectedBoardIndex: ?number,
  board: ?Board,
  renderURL: ?string,
};

const FetchMapListQuery = gql`
  query FetchMapList {
    map_list {
      index
      title
      location
      type
      color
      index_location
    }
  }
`;

const FetchMapDataQuery = gql`
  query FetchMap($index: Int!) {
    map(index: $index) {
      render_url
      data
    }
  }
`;

const InfoPanel = (props: {board: Board}) => {
  const {board} = props;
  const tileElements = board.getTileLists().map(({tiles, title}, i) => {
    return <h3 key={i}>{title}: {renderTileListValue(tiles)}</h3>
  });
  return (
    <div>
      <h1>{board.getName()}</h1>
      <h2>{board.getMapType()}</h2>
      <h2>Location: {board.getBriefingLocation()}</h2>
      {tileElements}
    </div>
  );
}

export default class MapViewerApp extends React.Component<Props, State> {
  static defaultProps = {};

  constructor(props: Props) {
    super(props);
    this.state = {
      searchText: '',
      board: null,
      selectedBoardIndex: null,
      renderURL: null,
    };
  }

  componentDidMount() {
    this.props.apollo
      .query({
        query: FetchMapListQuery,
        variables: {},
      })
      .then(result => {
        const mapIndex = result.data.map_list;
        this.setState({index: mapIndex});
        if (mapIndex.length > 0) {
          this.onItemPressed(mapIndex[0]);
        }
      })
      .catch(error => {
        this.setState({error});
      });
  }

  onSearchChange = (event: any) => {
    this.setState({
      searchText: event.target.value,
    });
  };

  onItemPressed = (item: IndexItem) => {
    const {board} = this.state;
    if (board && board.getName() === item.title) {
      return;
    }
    this.props.apollo
      .query({
        query: FetchMapDataQuery,
        variables: {index: item.index},
      })
      .then(response => {
        const board = Board.fromSerialized(response.data.map.data);
        this.setState({board, selectedBoardIndex: item.index, renderURL: response.data.map.render_url});
      });
  };

  getCandidateItems(items: Array<IndexItem>, filter: ?string): Array<IndexItem> {
    const index = nullthrows(this.state.index);
    if (!filter) {
      return index;
    }

    const finalFilter = filter.toLowerCase();

    return index.filter(item => {
      return item.title.toLowerCase().match(finalFilter);
    });
  }

  renderMapList() {
    if (!this.state.index) {
      return null;
    }
    const candidateItems = this.getCandidateItems(
      this.state.index,
      this.state.searchText,
    );

    const items = candidateItems.map((item) => {
      const selected = this.state.selectedBoardIndex === item.index;
      return (
        <div onClick={() => this.onItemPressed(item)}
          key={item.title}
          className={classNames(styles.indexItem, {[styles.indexItemActive]: selected})}>
          <h3 className={styles.indexItemTitle}>{item.title}</h3>
          <h4 className={styles.indexItemLocation}>{item.index_location}</h4>
        </div>
      )
    });
    return (
      <div className={styles.indexItemsContainer}>
        {items}
      </div>
    );
  }

  render() {
    const {searchText, board, renderURL} = this.state;
    const image = renderURL ? <img className={styles.renderImage} src={renderURL} /> : null;
    const panel = board
      ? <InfoPanel board={board} />
      : null;

    return (
      <Fragment>
        <div className={styles.root}>
          <div className={styles.leftPane}>
            <h1 className={styles.leftPaneTitle}>
              Imperial Assault Tile Guide
            </h1>
            <input className={styles.searchBar}
              placeholder="Search..."
              type="search"
              value={searchText}
              onChange={this.onSearchChange}
            />
            {this.renderMapList()}
          </div>
          <div className={styles.rightPane}>
            {panel}
            {image}
          </div>
        </div>
      </Fragment>
    );
  }
}
