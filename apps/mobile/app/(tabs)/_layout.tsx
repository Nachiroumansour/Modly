import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
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
      <BlurView
        tint="dark"
        intensity={36}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.veil} />
      <View style={styles.hairline} />
    </View>
  );
}

/**
 * Barre d'onglets adaptée au rôle (anticipe toute la structure du projet) :
 * - Sans compte : Accueil · Recherche · Profil
 * - Client      : Accueil · Recherche · Sauvegardés · Commandes · Profil
 * - Tailleur    : Accueil · Mes modèles · Clients · Commandes · Profil
 * Les onglets non pertinents sont masqués (href: null) mais leurs routes existent.
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const role = user?.role;
  const isClient = role === 'CLIENT';
  const isTailor = role === 'TAILLEUR';
  const authed = Boolean(role);

  const show = (visible: boolean) => (visible ? undefined : null);

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
      <Tabs.Screen name="feed" options={{ title: 'Accueil', tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="search"
        options={{ title: 'Recherche', tabBarIcon: icon('search'), href: show(!isTailor) }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{ title: 'Mes modèles', tabBarIcon: icon('grid'), href: show(isTailor) }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: 'Sauvegardés', tabBarIcon: icon('bookmark'), href: show(isClient) }}
      />
      <Tabs.Screen
        name="clients"
        options={{ title: 'Clients', tabBarIcon: icon('users'), href: show(isTailor) }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Commandes', tabBarIcon: icon('shopping-bag'), href: show(authed) }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('user') }} />
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
