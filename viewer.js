/* @flow */

import * as React from 'react';
import ReactDom from 'react-dom';
import Autosuggest from 'react-autosuggest';

import {getGridLayer, getEdgeLayer} from './renderer.js';

type IndexItem = {
  title: string,
  location: string,
  type: string,
};

type Props = {};
type State = {
  error?: Error,
  index?: Array<IndexItem>,
  suggestions: Array<IndexItem>,
  value: string,
};

// Teach Autosuggest how to calculate suggestions for any given input value.
const getSuggestions = (index: Array<IndexItem>, value: string) => {
  if (!value) {
	return [];
  }
  const inputValue = value.trim().toLowerCase();
  const inputLength = inputValue.length;

  return inputLength === 0 ? [] : index.filter(item =>
    item.title.toLowerCase().slice(0, inputLength) === inputValue
  );
};

const getSuggestionValue = item => item.name;

// Use your imagination to render suggestions.
const renderSuggestion = item => (
  <div>
    {item.title}
  </div>
);


export default class MapViewerApp extends React.Component<Props, State> {
  static defaultProps = {};

  constructor(props: Props) {
    super(props);
    this.state = {
	  suggestions: [],
	  value: '',
	};
  }

  componentDidMount() {
    fetch('/map/list')
      .then(resp => resp.json())
      .then(index => {
        this.setState({index});
      })
      .catch(error => {
        this.setState({error});
      });
  }
  onChange = (event, { newValue }) => {
	console.log('onchange', event, newValue);
    this.setState({
      value: newValue,
    });
  };

  // Autosuggest will call this function every time you need to update suggestions.
  // You already implemented this logic above, so just use it.
  onSuggestionsFetchRequested = ({ value }) => {
    this.setState({
      suggestions: getSuggestions(this.state.index || [], value)
    });
  };

  // Autosuggest will call this function every time you need to clear suggestions.
  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: []
    });
  };

  onSuggestionSelected = (event, { suggestion }) => {
	console.log(suggestion);
    this.setState({
	  value: suggestion.title,
	});
  };

  render() {
    const { value, suggestions } = this.state;

    // Autosuggest will pass through all these props to the input.
    const inputProps = {
      placeholder: 'Map Name',
      value,
      onChange: this.onChange,
    };

    return (
      <Autosuggest
        suggestions={suggestions}
        onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
        onSuggestionsClearRequested={this.onSuggestionsClearRequested}
        getSuggestionValue={getSuggestionValue}
        renderSuggestion={renderSuggestion}
        inputProps={inputProps}
		onSuggestionSelected={this.onSuggestionSelected}
      />
    );
  }
}
