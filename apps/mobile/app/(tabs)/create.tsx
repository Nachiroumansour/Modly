import { Redirect } from 'expo-router';

// L'onglet central "Publier" ouvre le flux /publish (via tabBarButton dans _layout).
// Ce composant n'est normalement jamais affiché ; en cas d'accès direct, on redirige.
export default function CreateTab() {
  return <Redirect href="/publish" />;
}
