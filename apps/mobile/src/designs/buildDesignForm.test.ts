import { buildDesignForm, type PublishInput } from './buildDesignForm';

type Parts = [string, unknown][];

function collect(input: PublishInput): Parts {
  const appended: Parts = [];
  const spy = jest
    .spyOn(FormData.prototype, 'append')
    .mockImplementation((key, value) => {
      appended.push([key, value]);
    });
  buildDesignForm(input);
  spy.mockRestore();
  return appended;
}

describe('buildDesignForm', () => {
  it('ajoute chaque image sous le champ media dans l ordre', () => {
    const parts = collect({
      uris: ['file:///a.jpg', 'file:///b.png'],
      title: 'Carrousel',
      category: 'ENSEMBLE',
      description: 'desc',
    });
    expect(parts.filter((p) => p[0] === 'media')).toHaveLength(2);
    expect(parts.some((p) => p[0] === 'title' && p[1] === 'Carrousel')).toBe(true);
    expect(parts.some((p) => p[0] === 'category' && p[1] === 'ENSEMBLE')).toBe(true);
    expect(parts.some((p) => p[0] === 'description' && p[1] === 'desc')).toBe(true);
  });

  it('omet la description vide', () => {
    const parts = collect({ uris: ['file:///a.jpg'], title: 'T', category: 'ROBE' });
    expect(parts.some((p) => p[0] === 'description')).toBe(false);
  });
});
