import Board from './board';

test('Board serialization', () => {
  const board = new Board(10, 10);

  let serialized = board.serialize();
  let newBoard = Board.fromSerialized(serialized);
  expect(newBoard.getWidth()).toBe(board.getWidth())
  expect(newBoard.getHeight()).toBe(board.getHeight());

  board.setCell(1, 2, {inBounds: true});
  board.setEdge(1, 2, 'Vertical', 'Wall');
  board.setEdge(3, 5, 'Vertical', 'Wall');
  board.setEdge(3, 5, 'Horizontal', 'Wall');

  newBoard = Board.fromSerialized(board.serialize());
  expect(newBoard.getCell(1, 2)).toEqual({inBounds: true});
  expect(newBoard.getEdge(1, 2, 'Vertical')).toBe('Wall');
  expect(newBoard.getEdge(3, 5, 'Vertical')).toBe('Wall');
  expect(newBoard.getEdge(3, 5, 'Horizontal')).toBe('Wall');
});
