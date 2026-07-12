import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, fonts } from '../../src/theme';

type FeatherName = keyof typeof Feather.glyphMap;

function icon(name: FeatherName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size - 1} color={color} />
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const authed = Boolean(user);
  const isTailor = user?.role === 'TAILLEUR';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textOnDarkMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopColor: colors.inkLine,
          borderTopWidth: StyleSheet_hairline(),
          height: Platform.OS === 'ios' ? 88 : 66,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Accueil', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="search" options={{ title: 'Recherche', tabBarIcon: icon('search') }} />
      <Tabs.Screen
        name="saved"
        options={{
          title: isTailor ? 'Clients' : 'Sauvegardés',
          tabBarIcon: icon(isTailor ? 'users' : 'bookmark'),
          href: authed ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Commandes',
          tabBarIcon: icon('shopping-bag'),
          href: authed ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

function StyleSheet_hairline(): number {
  return Platform.OS === 'ios' ? 0.5 : 1;
}
