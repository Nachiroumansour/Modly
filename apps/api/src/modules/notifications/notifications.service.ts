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
    const row = await prisma.notification.findUnique({
      where: {
        recipientId_type_groupKey: {
          recipientId: p.recipientId,
          type: p.type,
          groupKey: p.groupKey,
        },
      },
      select: { actorCount: true, lastActor: { select: { name: true } } },
    });
    const actorName = row?.lastActor?.name ?? 'Quelqu\'un';
    await sendPush(p.recipientId, notificationPushText(p.type, actorName, row?.actorCount ?? 1));
  } catch (err) {
    console.warn('createNotification a echoue (ignore):', err);
  }
}

type PushPayload = { title: string; body: string; data?: Record<string, unknown> };

const PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export async function sendPush(recipientId: string, payload: PushPayload): Promise<void> {
  try {
    const tokens = await prisma.pushToken.findMany({ where: { userId: recipientId }, select: { token: true } });
    if (tokens.length === 0) return; // no-op : aucun appareil enregistre
    const messages = tokens.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
    }));
    const res = await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
    // Nettoyage best-effort des jetons invalides
    const results = json.data ?? [];
    await Promise.all(
      results.map((r, i) =>
        r?.status === 'error' && r.details?.error === 'DeviceNotRegistered'
          ? prisma.pushToken.deleteMany({ where: { token: tokens[i].token } })
          : Promise.resolve(),
      ),
    );
  } catch (err) {
    console.warn('sendPush a echoue (ignore):', err);
  }
}

export function notificationPushText(type: NotifType, actorName: string, actorCount: number): PushPayload {
  const others = actorCount - 1;
  const who = others <= 0 ? actorName : others === 1 ? `${actorName} et 1 autre` : `${actorName} et ${others} autres`;
  switch (type) {
    case 'LIKE': return { title: 'Nouveau like', body: `${who} a aimé votre modèle.` };
    case 'COMMENT': return { title: 'Nouveau commentaire', body: `${actorName} a commenté votre modèle.` };
    case 'REPLY': return { title: 'Nouvelle réponse', body: `${actorName} a répondu à votre commentaire.` };
    case 'FOLLOW': return { title: 'Nouvel abonné', body: `${who} vous suit.` };
    case 'ORDER': return { title: 'Commande', body: `${actorName} : mise à jour de commande.` };
  }
}
