import { notificationText } from './render';
import type { ApiNotification } from '../types';

function n(over: Partial<ApiNotification>): ApiNotification {
  return {
    id: 'n1', type: 'LIKE', actorCount: 1, read: false,
    createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
    lastActor: { id: 'a1', name: 'Awa', avatarUrl: null },
    design: null, commentId: null, orderId: null, ...over,
  };
}

describe('notificationText', () => {
  it('like simple', () => {
    expect(notificationText(n({ type: 'LIKE', actorCount: 1 }))).toBe('Awa a aimé votre modèle.');
  });
  it('like regroupé', () => {
    expect(notificationText(n({ type: 'LIKE', actorCount: 3 }))).toBe('Awa et 2 autres ont aimé votre modèle.');
  });
  it('like regroupé singulier', () => {
    expect(notificationText(n({ type: 'LIKE', actorCount: 2 }))).toBe('Awa et 1 autre ont aimé votre modèle.');
  });
  it('follow', () => {
    expect(notificationText(n({ type: 'FOLLOW', actorCount: 1 }))).toBe('Awa vous suit.');
  });
  it('commentaire', () => {
    expect(notificationText(n({ type: 'COMMENT' }))).toBe('Awa a commenté votre modèle.');
  });
  it('réponse', () => {
    expect(notificationText(n({ type: 'REPLY' }))).toBe('Awa a répondu à votre commentaire.');
  });
  it('commande', () => {
    expect(notificationText(n({ type: 'ORDER' }))).toBe('Awa : mise à jour de votre commande.');
  });
});
