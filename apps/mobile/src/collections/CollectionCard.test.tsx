import { fireEvent, render, screen } from '@testing-library/react-native';
import { CollectionCard } from './CollectionCard';

describe('CollectionCard', () => {
  it('affiche nom et count, declenche onPress', () => {
    const onPress = jest.fn();
    render(<CollectionCard name="Mariage" count={12} covers={['/uploads/a.webp']} onPress={onPress} />);
    expect(screen.getByText('Mariage')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    fireEvent.press(screen.getByTestId('collection-card'));
    expect(onPress).toHaveBeenCalled();
  });
});
