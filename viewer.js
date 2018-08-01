/* @flow */

import * as React from 'react';
import ReactDom from 'react-dom';
import Board from './board';
import {renderTileListValue} from './BoardUtils';
import {BoardRenderer} from './renderer';
import ApolloClient from 'apollo-boost';
import gql from 'graphql-tag';
import nullthrows from 'nullthrows';

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

  board: ?Board,
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
      data
    }
  }
`;

const InfoPanel = (props: {board: Board}) => {
  const {board} = props;
  const tileElements = board.getTileLists().map(({tiles, title}) => {
    return <h3>{title}: {renderTileListValue(tiles)}</h3>
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
    };
  }

  componentDidMount() {
    this.props.apollo
      .query({
        query: FetchMapListQuery,
        variables: {},
      })
      .then(result => {
        this.setState({index: result.data.map_list});
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
        this.setState({board});
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
      return (
        <div onClick={() => this.onItemPressed(item)} key={item.title} style={{display: 'flex', flexFlow: 'column', paddingTop: 5, paddingBottom: 5}}>
          <h3 style={{}}>{item.title}</h3>
          <h4 style={{marginLeft: 16, color: item.color}}>{item.index_location}</h4>
        </div>
      )
    });
    return (
      <div style={{padding: 5}}>
        {items}
      </div>
    );
  }

  render() {
    const {searchText, board} = this.state;

    const map = board
      ? <BoardRenderer key={board.getName()} board={board} theme={{container: {height: '100%', width: '100%'}}} />
      : null;
    const panel = board
      ? <InfoPanel board={board} />
      : null;

    return (
      <React.Fragment>
        <div style={{display: 'flex', height: '100%', width: '100%'}}>
          <div style={{flex: "0 0 auto", padding: 5, overflow: 'auto'}}>
            <input type="search" value={searchText} onChange={this.onSearchChange} />
            {this.renderMapList()}
          </div>
          <div style={{display: 'flex', paddingLeft: 50, flexFlow: 'column', flex: "1 1 100%"}}>
            {panel}
            {map}
          </div>
        </div>
      </React.Fragment>
    );
  }
}
