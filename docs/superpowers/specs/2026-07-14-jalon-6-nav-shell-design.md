# Jalon 6 (tranche A+B) — Réalignement navigation + app shell

_Design validé le 2026-07-14._

## Contexte

Manou a partagé un flow de référence détaillé (deux captures : parcours client et
parcours tailleur). Comparé au build actuel de l'app mobile (`apps/mobile`), le
constat est :

- **Backend / modèle de données : quasi 1:1** avec la référence (timeline commande
  `EN_ATTENTE→TISSU_RECU→COUPE→COUTURE→FINITIONS→PRET→LIVREE`, 15 mesures,
  `MEASUREMENT_SOURCES` inclut `IA`, catégories par événement, statuts paiement).
  **Rien à changer côté API pour ce jalon.**
- **Navigation client : déjà identique** à la référence
  (`Accueil · Rechercher · Sauvegardés · Commandes · Profil`).
- **Divergences concentrées sur le tailleur et le « chrome » de l'app.**

Ce jalon couvre **A + B** uniquement. L'enrichissement des flows (bloc C : carrousel
détail, Commander/Mesures enrichis, sections Recherche, Sauvegardés 2 sections, écran
Paramètres) est explicitement **hors périmètre** et sera traité par tranches ensuite.

## Objectif

Aligner la **forme visible** de l'app sur le flow de référence :

1. **A — Nav réalignée** : même barre à 5 onglets pour client et tailleur, avec un
   onglet central mis en avant dont l'action dépend du rôle ; sortir Portfolio et
   Fiches clients de la barre du tailleur.
2. **B — App shell** : header permanent (logo + notifications + accès fiches clients
   pour le tailleur) et bouton central surélevé façon Instagram.

## A — Navigation réalignée

### Structure cible

```
Tailleur    : Accueil · Rechercher · [ ⊕ Publier ]     · Commandes · Profil
Client      : Accueil · Rechercher · [ 🔖 Sauvegardés ] · Commandes · Profil
Sans compte : Accueil · Rechercher · Profil
```

### Comportement

- **Onglet central** = pastille ronde accent **surélevée** (façon Insta) dans les deux
  rôles. Seuls l'icône, le label et la destination changent :
  - Tailleur → icône `plus`, label « Publier », destination = flux de publication.
  - Client → icône `bookmark`, label « Sauvegardés », destination = écran Sauvegardés.
- **Sans compte** : pas de bouton central ; barre à 3 onglets
  (`Accueil · Rechercher · Profil`). Les actions save/commande continuent d'inviter à
  s'inscrire (comportement existant conservé).
- **Ordre de déclaration** des routes dans `app/(tabs)/_layout.tsx` :
  `feed · search · publish · saved · orders · profile`, avec `href: null` sur les
  écrans non pertinents pour le rôle courant. Les routes `portfolio` et `clients`
  cessent d'être des onglets.
  - Tailleur visible : `feed · search · publish · orders · profile` → **publish en 3ᵉ
    (centre)**. `saved`, `clients`, `portfolio` masqués.
  - Client visible : `feed · search · saved · orders · profile` → **saved en 3ᵉ
    (centre)**. `publish` masqué.
  - Sans compte visible : `feed · search · profile`.

### Réorganisation des routes

- **Publier** : le flux de publication (aujourd'hui déclenché depuis l'onglet
  « Mes modèles »/`portfolio`) devient la destination de l'onglet central `publish`.
- **Portfolio (« Mes modèles »)** : la grille des publications du tailleur est
  **fusionnée dans le Profil** — le profil du tailleur est sa vitrine. L'onglet
  `portfolio` disparaît de la barre.
- **Fiches clients** : la route `clients` reste mais n'est plus un onglet. Elle devient
  accessible depuis (a) l'**icône Fiches clients du header** (tailleur) et (b) un bouton
  « Mes fiches clients » dans le **Profil** tailleur.

## B — App shell (chrome permanent)

### Header permanent — `AppHeader`

Composant partagé rendu en haut de chaque écran d'onglet
(`feed · search · saved · orders · profile`).

- **Gauche** : logo « Modly » (police Fraunces).
- **Droite** :
  - Cloche **notifications** (`bell`) → route `notifications`.
  - Pour le **tailleur uniquement** : icône **Fiches clients** (`users`) → liste des
    fiches clients.
- Respecte la safe-area (`useSafeAreaInsets`), posé au-dessus du feed sombre, fond
  cohérent avec l'identité sombre (mode sombre par défaut, conforme à la référence).

### Écran notifications — placeholder

- Route `app/notifications.tsx` : liste vide avec état « Bientôt tes notifications ».
- Volontairement minimal (les notifications push réelles sont dans le bloc C / futur).

### Bouton central surélevé

- `tabBarButton` custom sur l'onglet central : cercle accent en relief (léger overflow
  au-dessus de la barre), icône centrée, label dessous.
- Cohérent avec la barre en verre dépoli existante (`GlassTabBar`).

## Hors périmètre (bloc C — plus tard)

- Détail modèle en carrousel multi-images.
- Écran Commander enrichi (« je veux le même en bleu », joindre photo d'inspi, date).
- Écran Mesures enrichi (checkbox « mon tailleur prendra mes mesures », Scanner IA).
- Recherche : sections Tendances / Tailleurs populaires / Récemment consultés + toggle
  Modèles/Tailleurs.
- Sauvegardés en 2 sections (modèles sauvés + tailleurs suivis).
- Écran Paramètres complet (mode sombre togglable, langue, CGU, supprimer compte…).

## Tests

- **Nav role-aware** : pour chaque rôle (sans compte / client / tailleur), la barre
  affiche le bon set d'onglets et l'onglet central attendu à la bonne position.
- **AppHeader** : rendu du logo ; cloche notifications présente pour tous ; icône Fiches
  clients présente **uniquement** pour le tailleur.
- **Non-régression** : les écrans existants (feed, recherche, sauvegardés, commandes,
  profil, publication, clients, mesures) restent fonctionnels après le déplacement des
  routes.

## Décisions

- On **reste en mode sombre** (la référence indique « mode sombre activé par défaut ») —
  pas de bascule clair/sombre dans ce jalon.
- **Aucun changement backend** dans ce jalon.
- La cohérence « même barre client/tailleur » prime : c'est ce qui rend l'app plus
  lisible et plus proche du patron TikTok/Insta que la référence vise.
