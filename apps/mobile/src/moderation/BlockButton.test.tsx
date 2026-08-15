import { fireEvent, render, screen } from '@testing-library/react-native';
import { BlockButton } from './BlockButton';
import { useBlock, useBlockedIds, useUnblock } from './hooks';

jest.mock('./hooks');
const block = jest.fn().mockResolvedValue({});
const unblock = jest.fn().mockResolvedValue({});
(useBlock as jest.Mock).mockReturnValue({ block, blocking: false });
(useUnblock as jest.Mock).mockReturnValue({ unblock, unblocking: false });

it('affiche Bloquer puis appelle block', () => {
  (useBlockedIds as jest.Mock).mockReturnValue({ blockedIds: [], isBlocked: () => false });
  render(<BlockButton userId="u1" />);
  fireEvent.press(screen.getByText('Bloquer'));
  expect(block).toHaveBeenCalledWith('u1');
});

it('affiche Débloquer quand déjà bloqué', () => {
  (useBlockedIds as jest.Mock).mockReturnValue({ blockedIds: ['u1'], isBlocked: (id: string) => id === 'u1' });
  render(<BlockButton userId="u1" />);
  expect(screen.getByText('Débloquer')).toBeTruthy();
});
