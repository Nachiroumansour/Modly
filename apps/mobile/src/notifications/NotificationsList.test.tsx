import { fireEvent, render, screen } from '@testing-library/react-native';
import { NotificationsList } from './NotificationsList';
import type { ApiNotification } from '../types';

const base: ApiNotification = {
  id: 'n1', type: 'LIKE', actorCount: 2, read: false,
  createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
  lastActor: { id: 'a1', name: 'Awa', avatarUrl: null },
  design: { id: 'd1', title: 'Boubou', imageUrl: 'http://x/o.webp', coverBlurhash: null },
  commentId: null, orderId: null,
};

describe('NotificationsList', () => {
  it('affiche le texte regroupé et signale le non-lu', () => {
    render(<NotificationsList notifications={[base]} onPress={() => {}} />);
    expect(screen.getByText('Awa et 1 autre ont aimé votre modèle.')).toBeTruthy();
    expect(screen.getByTestId('notif-unread-n1')).toBeTruthy();
  });

  it('appelle onPress au tap', () => {
    const onPress = jest.fn();
    render(<NotificationsList notifications={[base]} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('notif-row-n1'));
    expect(onPress).toHaveBeenCalledWith(base);
  });

  it('n’affiche pas le point non-lu quand read=true', () => {
    render(<NotificationsList notifications={[{ ...base, read: true }]} onPress={() => {}} />);
    expect(screen.queryByTestId('notif-unread-n1')).toBeNull();
  });
});
