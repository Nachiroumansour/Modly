import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppHeader } from './AppHeader';
import { useAuth } from '../auth/AuthContext';
import { useUnreadCount } from '../notifications/hooks';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../auth/AuthContext');
jest.mock('../notifications/hooks');
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUnread = useUnreadCount as jest.MockedFunction<typeof useUnreadCount>;

function authState(over: Partial<ReturnType<typeof useAuth>>) {
  return { user: null, token: null, loading: false, register: jest.fn(), login: jest.fn(), logout: jest.fn(), ...over } as ReturnType<typeof useAuth>;
}

describe('AppHeader', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockedUnread.mockReturnValue({ count: 0, refetch: jest.fn() });
  });

  it('affiche le logo Modly et la cloche notifications', () => {
    mockedUseAuth.mockReturnValue(authState({ user: { id: 'c', name: 'Awa', role: 'CLIENT', phone: '', avatarUrl: null } as any }));
    render(<AppHeader />);
    expect(screen.getByText('Modly')).toBeTruthy();
    expect(screen.getByTestId('header-notifications')).toBeTruthy();
  });

  it("n'affiche PAS l'icône fiches clients pour un client", () => {
    mockedUseAuth.mockReturnValue(authState({ user: { id: 'c', name: 'Awa', role: 'CLIENT', phone: '', avatarUrl: null } as any }));
    render(<AppHeader />);
    expect(screen.queryByTestId('header-clients')).toBeNull();
  });

  it("affiche l'icône fiches clients pour un tailleur et ouvre /clients", () => {
    mockedUseAuth.mockReturnValue(authState({ user: { id: 't', name: 'Modou', role: 'TAILLEUR', phone: '', avatarUrl: null } as any }));
    render(<AppHeader />);
    fireEvent.press(screen.getByTestId('header-clients'));
    expect(mockPush).toHaveBeenCalledWith('/clients');
  });

  it('la cloche ouvre /notifications', () => {
    mockedUseAuth.mockReturnValue(authState({ user: null }));
    render(<AppHeader />);
    fireEvent.press(screen.getByTestId('header-notifications'));
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });
});

describe('AppHeader pastille', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1', role: 'CLIENT' } } as ReturnType<typeof useAuth>);
  });

  it('montre la pastille quand des notifs non lues existent', () => {
    mockedUnread.mockReturnValue({ count: 3, refetch: jest.fn() });
    render(<AppHeader />);
    expect(screen.getByTestId('header-unread-dot')).toBeTruthy();
  });

  it('cache la pastille quand count=0', () => {
    mockedUnread.mockReturnValue({ count: 0, refetch: jest.fn() });
    render(<AppHeader />);
    expect(screen.queryByTestId('header-unread-dot')).toBeNull();
  });
});
