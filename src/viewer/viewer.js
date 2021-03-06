/* @flow */

import React from 'react';
import {Fragment} from 'react';
import ReactDom from 'react-dom';
import classNames from 'classnames';

import styles from './viewer.css';

import index from '../../viewer_data.json';
import GithubIcon from './github_icon.svg';

type IndexItem = {
  index: number,
  title: string,
  location: string,
  type: string,
  color: string,
  indexLocation: string,
  tileLists: Array<{
    title: string,
    tiles: Array<string>,
  }>,
  renderURL: string,
};

type Props = {
};

type State = {
  error?: Error,
  index: Array<IndexItem>,
  searchText: string,
  listExpanded: boolean,

  selectedItem: ?IndexItem,
};

function renderTileListItem(tile: string, count: number) {
  if (count < 2) {
    return tile;
  }
  return `${tile.trim()}(${count})`;
}

function renderTileListValue(tileList: Array<string>): string {
  const reduced = [];
  let lastTile = null;
  let count = 0;
  tileList.forEach(tile => {
    if (tile !== lastTile) {
      if (lastTile !== null) {
        reduced.push(renderTileListItem(lastTile, count));
      }
      lastTile = tile;
      count = 1;
    } else {
      count++;
    }
  });
  if (lastTile) {
    reduced.push(renderTileListItem(lastTile, count));
  }

  return reduced.join(', ');
}


const InfoPanel = (props: {item: IndexItem}) => {
  const {item} = props;
  const tileElements = item.tileLists.map(({tiles, title}, i) => {
    return <h3 key={i}>{title}: {renderTileListValue(tiles)}</h3>
  });
  return (
    <div className={styles.infoPanel}>
      <h1>{item.title}</h1>
      <h2>{item.type}</h2>
      <h2>Location: {item.location}</h2>
      {tileElements}
    </div>
  );
}

export default class MapViewerApp extends React.Component<Props, State> {
  static defaultProps = {};
  searchBar: ?HTMLInputElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      index: index,
      searchText: '',
      board: null,
      selectedItem: index[0],
      listExpanded: true,
    };
  }

  onSearchChange = (event: any) => {
    this.setState({
      searchText: event.target.value,
    });
  };

  onItemPressed = (item: IndexItem) => {
    if (this.state.selectedItem && this.state.selectedItem.index === item.index) {
      return;
    }
    this.setState({selectedItem: item, listExpanded: false});
  };

  onToggleMapList = () => {
    this.setState({listExpanded: !this.state.listExpanded, searchText: ''}, () => {
      if (this.state.listExpanded && this.searchBar) {
        this.searchBar.focus();
      }
    });
  }

  getCandidateItems(items: Array<IndexItem>, filter: ?string): Array<IndexItem> {
    if (!filter) {
      return items;
    }

    const finalFilter = filter.toLowerCase();

    return items.filter(item => {
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
      const selected = this.state.selectedItem && this.state.selectedItem.index === item.index;
      return (
        <div onClick={() => this.onItemPressed(item)}
          key={item.title}
          className={classNames(styles.indexItem, {[styles.indexItemActive]: selected})}>
          <h3 className={styles.indexItemTitle}>{item.title}</h3>
          <h4 className={styles.indexItemLocation}>{item.indexLocation}</h4>
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
    const {searchText, selectedItem} = this.state;
    const image = selectedItem
      //? <img key={selectedItem.renderURL} className={styles.renderImage} src={selectedItem.renderURL} />
      ? <div className={styles.renderDiv} style={{backgroundImage: `url(${selectedItem.renderURL})`}} />
      : null;
    const panel = selectedItem
      ? <InfoPanel item={selectedItem} />
      : null;

    return (
      <div className={styles.root}>
        <div className={styles.topNav}>
          <div
            className={styles.topNavSearch}
            onClick={this.onToggleMapList} />
          <h1 className={styles.topNavTitle}>Imperial Assault Tile Guide</h1>
          <a className={styles.topNavLink} target="_blank" href="https://zackgomez.com/files/Campaign_Tile_Guide_v11.0.pdf">Download PDF</a>
          <a className={styles.topNavLink} target="_blank" href="https://github.com/zackgomez/iamapbuilder">
            <img src={GithubIcon} className={styles.githubIcon}/>
          </a>
        </div>
        <div className={styles.panesContainer}>
          <div className={classNames(styles.leftPane, {[styles.leftPaneCollapsed]: !this.state.listExpanded})}>
            <input className={styles.searchBar}
              ref={(searchBar) => this.searchBar = searchBar}
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
      </div>
    );
  }
}
