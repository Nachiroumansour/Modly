import { fireEvent, render, screen } from '@testing-library/react-native';
import { CollectionPickerSheet } from './CollectionPickerSheet';

const collections = [
  { id: 'c1', name: 'Mariage', count: 2, covers: [] },
  { id: 'c2', name: 'Boubous', count: 5, covers: [] },
];

describe('CollectionPickerSheet', () => {
  it('liste les collections et range au choix', () => {
    const onPick = jest.fn();
    render(<CollectionPickerSheet visible collections={collections} onClose={jest.fn()} onPick={onPick} onCreate={jest.fn()} />);
    expect(screen.getByText('Mariage')).toBeTruthy();
    fireEvent.press(screen.getByTestId('picker-c2'));
    expect(onPick).toHaveBeenCalledWith('c2');
  });

  it('ferme via le backdrop', () => {
    const onClose = jest.fn();
    render(<CollectionPickerSheet visible collections={collections} onClose={onClose} onPick={jest.fn()} onCreate={jest.fn()} />);
    fireEvent.press(screen.getByTestId('picker-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
