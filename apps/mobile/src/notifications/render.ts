import type { ApiNotification } from '../types';

// NB: fichier .ts -> apostrophes DROITES uniquement (contrainte babel).
function who(name: string, actorCount: number): string {
  const others = actorCount - 1;
  if (others <= 0) return name;
  if (others === 1) return `${name} et 1 autre`;
  return `${name} et ${others} autres`;
}

export function notificationText(n: ApiNotification): string {
  const name = n.lastActor?.name ?? 'Quelqu\'un';
  switch (n.type) {
    case 'LIKE': return `${who(name, n.actorCount)} ${n.actorCount > 1 ? 'ont' : 'a'} aimé votre modèle.`;
    case 'FOLLOW': return `${who(name, n.actorCount)} vous ${n.actorCount > 1 ? 'suivent' : 'suit'}.`;
    case 'COMMENT': return `${name} a commenté votre modèle.`;
    case 'REPLY': return `${name} a répondu à votre commentaire.`;
    case 'ORDER': return `${name} : mise à jour de votre commande.`;
  }
}
