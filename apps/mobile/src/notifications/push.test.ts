import { registerPushToken } from './push';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getExpoPushTokenAsync: jest.fn(),
}));

describe('registerPushToken', () => {
  it('ne jette pas et n\'enregistre rien si la permission est refusée', async () => {
    await expect(registerPushToken('tok')).resolves.toBeUndefined();
  });
});
