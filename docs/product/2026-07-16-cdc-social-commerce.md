# Modly — Cahier des charges produit (spec de référence)

_Reçu de Manou le 16/07/2026. Spec de référence « north-star » : toute la roadmap
en découle. Découpé en MVP1 (découverte & communauté) → MVP2 (commerce) → MVP3
(avancé) → écosystème tissu. Chaque sous-bloc a ensuite sa propre spec + plan._

> Ce document est la copie fidèle de la décision produit. Les specs de blocs
> (`docs/superpowers/specs/`) référencent ce fichier.

---

## Décision produit

Modly est une marketplace sociale de mode sur mesure. La découverte visuelle est le
point d'entrée : les tailleurs publient leurs créations et les clients explorent,
recherchent, enregistrent, commentent, suivent les créateurs puis commandent depuis
un modèle.

Les clients ne publient pas de contenu dans le MVP. Ils peuvent consulter des photos
et vidéos, liker, commenter, enregistrer dans des collections, suivre des tailleurs et
commander. Les tailleurs sont les seuls producteurs de contenu.

## Objectifs

1. Rendre les tailleurs visibles grâce à un catalogue social riche en images/vidéos.
2. Permettre aux clients de découvrir facilement un modèle et le bon tailleur.
3. Transformer une inspiration en commande personnalisée, sans rupture de parcours.
4. Centraliser les mensurations client et les fiches de mesures des tailleurs.
5. Donner au tailleur un suivi clair de son contenu, ses clients et ses commandes.

## Rôles et permissions

| Action | Client | Tailleur |
|---|---:|---:|
| Voir posts photo/vidéo | Oui | Oui |
| Rechercher et filtrer | Oui | Oui |
| Liker, commenter, enregistrer, suivre | Oui | Oui |
| Publier ou modifier un modèle | Non | Oui |
| Commander un modèle | Oui | Non |
| Gérer commandes et statuts | Voir ses commandes | Oui |
| Gérer une fiche client | Gère ses propres mesures | Oui |

## Créations originales : attribution simple et rémunération

Deux statuts visibles pour une publication tailleur :

- **Inspiration** : contenu de découverte ; source ajoutée si connue ; pas de licence.
- **Création originale Modly** : déclarée par son tailleur auteur, badge + date + lien
  vers le profil créateur.

Sur une création originale :
- **Client : « Commander auprès de ce tailleur ».**
- **Tailleur : « S'inspirer professionnellement »** → licence simple d'inspiration ;
  le créateur reçoit une part, Modly une commission, l'acquéreur garde la trace.

La licence n'autorise ni à revendiquer le modèle comme création personnelle ni la
reproduction exacte inconditionnelle. Protection = provenance, attribution, licences
in-app, signalement. (Note d'ingénierie : la partie licence payante dépend du paiement
→ différée ; l'attribution/badge/source/signalement est faisable tôt.)

## Architecture de navigation

**Client** : Accueil (feed masonry perso) · Explorer (recherche/filtres) · Enregistrés
(collections privées) · Commandes · Profil (mensurations, préférences, suivis, réglages).

**Tailleur** : Accueil/Inspiration · Publier · Boutique (profil public, catalogue,
abonnés, avis) · Commandes · Clients (fiches, mesures, historique, notes).

## Parcours client (résumé)

Splash → Welcome → Onboarding (compte + styles/occasions/tailles/villes + notifs) →
Accueil (feed masonry infini, onglets « Pour vous »/« Abonnements », chips catégories)
→ Explorer → Détail post (média plein écran, actions, « Vous aimerez aussi ») → Profil
tailleur → Collection enregistrée → Config commande (couleur/taille/adaptations, prix
et délai estimatifs) → Mensurations (profil / saisie / scan IA-OCR, confirmation) →
Conversation de commande (canal privé) → Validation commerciale (accepte/ajuste/refuse)
→ Paiement (après accord prix+délai) → Suivi (états + journal horodaté) → Après
livraison (avis + collection).

## Parcours tailleur (résumé)

Splash/Welcome/Connexion (rôle tailleur) → Onboarding boutique → Dashboard → Publication
(photo/vidéo verticale, titre/desc/tags/catégorie/prix/délai) → Gestion catalogue →
Communauté (commentaires/abonnés) → Commande entrante + conversation
(accepter/corriger mesures/refuser) → Production (statut + mises à jour) → Clients →
Fiche client (mesures manuelles ; mesures confirmées client identifiées comme partagées).

## Mensurations et confidentialité

- Le client possède ses profils de mesures et peut les modifier.
- Création manuelle ou via caméra (IA/OCR propose, le client confirme avant usage).
- Le tailleur peut renseigner/corriger des mesures dans sa fiche client.
- À chaque commande, le client confirme le profil transmis.
- Le tailleur ne voit que les mesures associées à sa commande / fiche.

## Écrans transverses obligatoires

Mot de passe oublié, vérification compte, déconnexion ; autorisations caméra/galerie/
notifs avec états de refus ; centre de notifications ; états vides/chargement/hors-ligne/
erreur ; réglages compte/confidentialité/blocage/signalement ; confirmation/échec paiement.

## UI / UX

Mobile-first, nav basse 5 entrées par rôle. Feed masonry dominant avec vraies photos +
vidéos verticales courtes. Inspiré de Pinterest (découverte, enregistrement, densité
visuelle) sans copier l'UI. Grandes images, surfaces claires, typo éditoriale, icônes
explicites, CTA terracotta, micro-interactions rapides. Cartes = modèle + tailleur +
média + actions immédiates (aimer/enregistrer/commander).

### Comportements sociaux de référence

- **Post photo** : vue détaillée + interactions + recommandations sous le post.
- **Post vidéo** : lecteur vertical plein écran type reels (autoplay muet, son activable,
  actions superposées, suivre/commander), défilement vertical, préchargement du suivant.
- Catégories/tags cliquables → feed contextualisé. Recos = likes/enregistrements/
  abonnements/recherches/catégories.
- Commentaires hiérarchisés : réponse, like commentaire, signalement, suppression par
  l'auteur, épingle par le tailleur.

## Fondations d'un produit social viable

- Publication = id, auteur, médias optimisés, catégorie, tags, visibilité, date,
  paramètres de commande.
- Feeds en **pagination par curseur** (jamais tout charger).
- Médias hors app, servis via **CDN**, multi-formats/résolutions ; images progressives ;
  vidéos en streaming adaptatif.
- Reco : logique explicable (abonnements, tags, catégories, popularité récente,
  localisation) puis signaux agrégés.
- Social graph : abonnements/likes/enregistrements/commentaires/vues = objets séparés
  indexés ; compteurs agrégés async ; **interactions idempotentes**.
- Notifications async, regroupées (anti-spam).
- Modération : signalement, blocage, contrôle formats/taille, analyse contenu à risque,
  limitation de fréquence commentaires, journal de modération, droits médias explicites.
- API par domaines : identité · catalogue/médias · social · recherche/reco ·
  commandes/paiements · mensurations. Tâches lourdes en file async. Mesures/paiements
  chiffrés. États de reprise. Observabilité dès le départ.

## Flow de commande : états

| État | Déclencheur | Règle |
|---|---|---|
| Brouillon | Client | Invisible du tailleur ; repris ou supprimé. |
| Demande envoyée | Client | Le tailleur reçoit modèle+options+mesures, sans paiement. |
| À ajuster | Tailleur | Propose prix/délai/options/mesures ; le client accepte. |
| Refusée | Tailleur/client | Motif obligatoire (tailleur) ; rien encaissé. |
| Acceptée | Tailleur+client | Prix/délai/périmètre figés avant paiement. |
| Acompte payé | Client | Commande active. |
| Mesures à confirmer | Client/Tailleur | Pas de confection avant confirmation explicite. |
| En confection | Tailleur | Mises à jour de production. |
| Prête | Tailleur | Retrait/livraison. |
| Livrée | Client/preuve | Ouvre avis + réclamation. |
| Litige/annulation/remboursement | Client/tailleur/support | État séparé journalisé. |

**Le paiement ne devance jamais l'acceptation du tailleur. Les mesures ne sont partagées
que pour une commande acceptée et sélectionnée par le client.**

## Canal de communication de commande

Chaque demande crée un fil privé persistant lié au numéro de commande. Pas une messagerie
sociale générale. MVP : texte, photos de référence/avancement, réponses rapides, messages
système, demandes structurées (proposer prix/délai, demander mesure/photo, confirmer
mesures, signaler prêt). Toute proposition prix/délai/option devient une carte
récapitulative dont l'accord met à jour la commande + journal. Fil accessible après
livraison, verrouillé après la fenêtre de réclamation. Signalement/blocage possibles ;
support accède seulement en cas de litige (trace). Notifs sans dévoiler le contenu.
**Pas de messagerie privée libre au MVP** (appels/vocaux/groupes différés).

## Séquençage

- **MVP1 — découverte & communauté** : auth, onboarding, feed masonry, détail post +
  recos catégorie, recherche, profil tailleur, publication photo, likes, commentaires,
  abonnements, collections, notifications, signalement, fondations CDN/pagination.
- **MVP2 — commerce** : config commande, mensurations manuelles, acompte, fiche client
  tailleur, suivi commande, canal de conversation.
- **MVP3 — avancé** : vidéo reels, scan IA/OCR, recos perso, analytics, modération +.
- **Écosystème tissu (après)** : vendeurs de tissu vérifiés (3e rôle), catalogue,
  réservation liée à commande ; Modly ne porte pas de stock au départ.

## Critères de réussite UX

- Un client accède à un modèle commandable en < 3 interactions depuis le feed.
- Enregistrer/suivre depuis tout post ou profil pertinent.
- Une commande ne part pas sans choix de mesures explicite.
- Un tailleur publie et associe prix/délai sans quitter le flux de publication.
- Les deux rôles comprennent le prochain statut d'une commande sans contacter le support.

## Limites MVP

Pas de publication client ; pas de messagerie privée libre ; méthode de scan à choisir ;
règles de modération/droits médias/paiement local à définir avant production.

---

## État de réconciliation (16/07/2026)

Ce qui est construit ≈ **MVP1 à ~75-80 %** (jalon 6 nav/shell, blocs A média multi-format,
D1 détail pin social, D2 profil social, popup commentaires, B1 mesures perso client).
Décision : **finir MVP1 proprement** avant d'attaquer MVP2 commerce.

Backlog « finir MVP1 » (chacun = un cycle spec→plan→dev) :
- **M1 Collections nommées** (Sauvegardés → boards) — EN COURS.
- M2 Feed pagination curseur + onglet Abonnements.
- M3 Commentaires hiérarchisés (réponses, like, épingle).
- M4 Centre de notifications.
- M5 Signalement / blocage.
- M6 Profil tailleur couverture (+ avis différés MVP2).
- M7 Onboarding préférences (styles/occasions/villes).
- M8 Badge Inspiration / Création originale (attribution ; licence payante différée).

Différé : MVP3 (vidéo reels, scan IA, algo reco), licences payantes, écosystème tissu,
paiement (dépendance prestataire externe — Wave/Orange Money).
