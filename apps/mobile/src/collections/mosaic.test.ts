import { mosaicSlots } from './mosaic';

describe('mosaicSlots', () => {
  it('tronque a 4', () => {
    expect(mosaicSlots(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd']);
  });
  it('garde 1 a 3 tel quel', () => {
    expect(mosaicSlots(['a'])).toEqual(['a']);
    expect(mosaicSlots(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
  it('vide -> []', () => {
    expect(mosaicSlots([])).toEqual([]);
  });
});
