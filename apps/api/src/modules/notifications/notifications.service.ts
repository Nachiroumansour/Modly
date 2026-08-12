import { prisma } from '../../lib/prisma.js';

export type NotifType = 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'ORDER';

export type CreateNotifParams = {
  recipientId: string;
  actorId: string;
  type: NotifType;
  groupKey: string;
  designId?: string | null;
  commentId?: string | null;
  orderId?: string | null;
};

/** Cree ou regroupe une notification. Jamais d'auto-notification. Best-effort. */
export async function createNotification(p: CreateNotifParams): Promise<void> {
  if (p.actorId === p.recipientId) return;
  try {
    await prisma.notification.upsert({
      where: {
        recipientId_type_groupKey: {
          recipientId: p.recipientId,
          type: p.type,
          groupKey: p.groupKey,
        },
      },
      create: {
        recipientId: p.recipientId,
        type: p.type,
        groupKey: p.groupKey,
        actorCount: 1,
        lastActorId: p.actorId,
        designId: p.designId ?? null,
        commentId: p.commentId ?? null,
        orderId: p.orderId ?? null,
        read: false,
      },
      update: {
        actorCount: { increment: 1 },
        lastActorId: p.actorId,
        read: false,
      },
    });
  } catch (err) {
    console.warn('createNotification a echoue (ignore):', err);
  }
}
