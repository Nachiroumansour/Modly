import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { CenterTabButton } from '../../src/navigation/CenterTabButton';
import { centerTab, visibleTabs, type TabName } from '../../src/navigation/tabs';
import { colors, fonts } from '../../src/theme';

type FeatherName = keyof typeof Feather.glyphMap;

function icon(name: FeatherName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size - 1} color={color} />
  );
}

// Fond en verre dépoli (façon WhatsApp/iOS) — blur + voile sombre pour le contraste.
function GlassTabBar() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView tint="dark" intensity={36} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={styles.veil} />
      <View style={styles.hairline} />
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
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Accueil', tabBarIcon: icon('home'), href: href('feed') }} />
      <Tabs.Screen name="search" options={{ title: 'Recherche', tabBarIcon: icon('search'), href: href('search') }} />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Publier',
          href: href('create'),
          // Le bouton central "Publier" ouvre directement le flux /publish
          // (il ne bascule PAS vers l'onglet create, qui n'est qu'un redirect de secours).
          tabBarButton: () => <CenterTabButton icon="plus" label="Publier" onPress={() => router.push('/publish')} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Sauvegardés',
          href: href('saved'),
          tabBarButton:
            center === 'saved' ? (p) => <CenterTabButton icon="bookmark" label="Sauvegardés" onPress={p.onPress} /> : undefined,
          tabBarIcon: icon('bookmark'),
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
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(23,18,15,0.55)' },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(246,241,233,0.12)',
  },
});
