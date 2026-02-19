import { describe, expect, it } from 'vitest';

import { visibleWidth, wrapTableColumn } from '../../src/render/table-text-layout.js';

describe('table-text-layout', () => {
  it('measures visible width while ignoring ansi sequences', () => {
    expect(visibleWidth('\u001B[31mhello\u001B[39m')).toBe(5);
  });

  it('counts full-width unicode characters as width 2', () => {
    expect(visibleWidth('漢字')).toBe(4);
  });

  it('wraps at spaces when possible', () => {
    const wrappedRows = wrapTableColumn([['period', 'source', 'hello world']], {
      columnIndex: 2,
      width: 5,
    });

    expect(wrappedRows[0][2]).toBe('hello\nworld');
  });

  it('wraps long words by width when there are no spaces', () => {
    const wrappedRows = wrapTableColumn([['period', 'source', 'abcdefghij']], {
      columnIndex: 2,
      width: 4,
    });

    expect(wrappedRows[0][2]).toBe('abcd\nefgh\nij');
  });

  it('requires a positive wrap width', () => {
    expect(() =>
      wrapTableColumn([['period', 'source', 'text']], {
        columnIndex: 2,
        width: 0,
      }),
    ).toThrow('wrapTableColumn width must be greater than 0');
  });
});
