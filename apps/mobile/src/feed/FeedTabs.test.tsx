import { fireEvent, render, screen } from '@testing-library/react-native';
import { FeedTabs } from './FeedTabs';

describe('FeedTabs', () => {
  it('affiche les deux onglets et bascule', () => {
    const onChange = jest.fn();
    render(<FeedTabs scope="foryou" onChange={onChange} showFollowing />);
    expect(screen.getByTestId('tab-foryou')).toBeTruthy();
    fireEvent.press(screen.getByTestId('tab-following'));
    expect(onChange).toHaveBeenCalledWith('following');
  });

  it('masque Abonnements si showFollowing est faux', () => {
    render(<FeedTabs scope="foryou" onChange={jest.fn()} showFollowing={false} />);
    expect(screen.queryByTestId('tab-following')).toBeNull();
  });
});
