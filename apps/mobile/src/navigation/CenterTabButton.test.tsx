import { fireEvent, render, screen } from '@testing-library/react-native';
import { CenterTabButton } from './CenterTabButton';

describe('CenterTabButton', () => {
  it('affiche le label et déclenche onPress', () => {
    const onPress = jest.fn();
    render(<CenterTabButton icon="plus" label="Publier" onPress={onPress} />);
    expect(screen.getByText('Publier')).toBeTruthy();
    fireEvent.press(screen.getByText('Publier'));
    expect(onPress).toHaveBeenCalled();
  });
});
