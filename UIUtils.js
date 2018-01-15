/* @flow */
'use strict';

import _ from 'lodash';

export type Size = {
  width: number,
  height: number,
};

export function makeButton(title: string, size: Size, extraStyle: Object, onClick: (e: any) => void): any {
  let style = {
    align: 'center',
    fontSize: 16,
    fill: '#FFFFFF',
  };

  style = _.extend(style, extraStyle);

  let button = new PIXI.Text(title, style);
  button.interactive = true;
  button.buttonMode = true;
  button.on('pointerdown', (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return button;
}
