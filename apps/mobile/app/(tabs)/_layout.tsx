import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { CenterTabButton } from '../../src/navigation/CenterTabButton';
import { centerTab, visibleTabs, type TabName } from '../../src/navigation/tabs';
import { colors, fonts, spacing } from '../../src/theme';

type FeatherName = keyof typeof Feather.glyphMap;

function icon(name: FeatherName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size - 1} color={color} />
  );
}

// Fond en verre dépoli flottant (façon WhatsApp) — blur arrondi + voile sombre translucide.
function GlassTabBar() {
  return (
    <View style={styles.glass}>
      <BlurView tint="dark" intensity={50} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={styles.veil} />
    </View>
  );
}

/**
 * Barre d'onglets alignée sur le flow de référence :
 * - Sans compte : Accueil · Recherche · Profil
 * - Client      : Accueil · Recherche · [Sauvegardés] · Commandes · Profil
 * - Tailleur    : Accueil · Recherche · [⊕ Publier] · Commandes · Profil
 * L'onglet central (index 2) est surélevé. Portfolio et Clients ne sont plus des
 * onglets (href: null) ; ils restent accessibles via le profil et le header.
 */
export default function TabsLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? null;
  const visible = visibleTabs(role);
  const center = centerTab(role);
  const href = (name: TabName) => (visible.includes(name) ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textOnDarkMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
        tabBarBackground: () => <GlassTabBar />,
        // Barre flottante arrondie (façon WhatsApp) : marges latérales + bas, coins arrondis.
        tabBarStyle: {
          position: 'absolute',
          left: spacing.lg,
          right: spacing.lg,
          bottom: Platform.OS === 'ios' ? 30 : 20,
          height: 66,
          borderRadius: 33,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: 10,
          paddingHorizontal: spacing.sm,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
        },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Accueil', tabBarIcon: icon('home'), href: href('feed') }} />
      <Tabs.Screen name="search" options={{ title: 'Recherche', tabBarIcon: icon('search'), href: href('search') }} />
      {/* create & saved sont les onglets centraux : leur visibilité passe par
          tabBarItemStyle (et non href) car expo-router interdit href + tabBarButton. */}
      <Tabs.Screen
        name="create"
        options={{
          title: 'Publier',
          tabBarItemStyle: center === 'create' ? undefined : { display: 'none' },
          // Le bouton central "Publier" ouvre directement le flux /publish
          // (il ne bascule PAS vers l'onglet create, qui n'est qu'un redirect de secours).
          tabBarButton:
            center === 'create'
              ? () => <CenterTabButton icon="plus" label="Publier" onPress={() => router.push('/publish')} />
              : () => null,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Sauvegardés',
          tabBarItemStyle: center === 'saved' ? undefined : { display: 'none' },
          tabBarButton:
            center === 'saved'
              ? (p) => <CenterTabButton icon="bookmark" label="Sauvegardés" onPress={p.onPress} />
              : () => null,
        }}
      />
      <Tabs.Screen name="orders" options={{ title: 'Commandes', tabBarIcon: icon('shopping-bag'), href: href('orders') }} />
      <Tabs.Screen name="portfolio" options={{ href: null }} />
      <Tabs.Screen name="clients" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('user'), href: href('profile') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Conteneur du verre : arrondi + clip du blur, fine bordure claire (bord de verre).
  glass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 33,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,241,233,0.16)',
  },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(23,18,15,0.5)' },
});
