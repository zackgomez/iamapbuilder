/* @flow */

import * as React from 'react';
import ReactDom from 'react-dom';
import Autosuggest from 'react-autosuggest';
import Board from './board';
import {BoardRenderer} from './renderer';
import ApolloClient from 'apollo-boost';
import gql from 'graphql-tag';

type IndexItem = {
  index: number,
  title: string,
  location: string,
  type: string,
};

type Props = {
  apollo: ApolloClient,
};
type State = {
  error?: Error,
  index?: Array<IndexItem>,
  suggestions: Array<IndexItem>,
  value: string,

  board: ?Board,
};

// Teach Autosuggest how to calculate suggestions for any given input value.
const getSuggestions = (index: Array<IndexItem>, value: string) => {
  if (!value) {
    return [];
  }
  const inputValue = value.trim().toLowerCase();
  const inputLength = inputValue.length;

  return inputLength === 0
    ? []
    : index.filter(item => item.title.toLowerCase().slice(0, inputLength) === inputValue);
};

const getSuggestionValue = item => item.name;

// Use your imagination to render suggestions.
const renderSuggestion = item => <div>{item.title}</div>;

const FetchMapListQuery = gql`
  query FetchMapList {
    map_list {
      index
      title
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

export default class MapViewerApp extends React.Component<Props, State> {
  static defaultProps = {};

  constructor(props: Props) {
    super(props);
    this.state = {
      suggestions: [],
      value: '',
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
  onChange = (event: any, {newValue}: {newValue: string}) => {
    this.setState({
      value: newValue,
    });
  };

  // Autosuggest will call this function every time you need to update suggestions.
  // You already implemented tthishis logic above, so just use it.
  onSuggestionsFetchRequested = ({value}: {value: string}) => {
    this.setState({
      suggestions: getSuggestions(this.state.index || [], value),
    });
  };

  // Autosuggest will call this function every time you need to clear suggestions.
  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    });
  };

  onSuggestionSelected = (event: any, {suggestion}: {suggestion: IndexItem}) => {
    this.setState({
      value: suggestion.title,
    });
    const {board} = this.state;
    if (board && board.title === suggestion.title) {
      return;
    }
    this.props.apollo
      .query({
        query: FetchMapDataQuery,
        variables: {index: suggestion.index},
      })
      .then(response => {
        const board = Board.fromSerialized(response.data.map.data);
        this.setState({board});
      });
  };

  render() {
    const {value, suggestions, board} = this.state;

    // Autosuggest will pass through all these props to the input.
    const inputProps = {
      placeholder: 'Map Name',
      value,
      onChange: this.onChange,
    };

    const map = board ? <BoardRenderer key={board.getName()} board={board} /> : null;

    const theme = {
      float: 'left',
    };

    return (
      <React.Fragment>
        <Autosuggest
          theme={theme}
          suggestions={suggestions}
          onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
          onSuggestionsClearRequested={this.onSuggestionsClearRequested}
          getSuggestionValue={getSuggestionValue}
          renderSuggestion={renderSuggestion}
          inputProps={inputProps}
          onSuggestionSelected={this.onSuggestionSelected}
        />
        {map}
      </React.Fragment>
    );
  }
}
