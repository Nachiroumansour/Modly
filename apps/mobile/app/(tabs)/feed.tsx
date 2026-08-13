import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { Feed } from '../../src/feed/Feed';
import { FeedTabs } from '../../src/feed/FeedTabs';
import type { FeedScope } from '../../src/feed/useFeed';
import { colors } from '../../src/theme';
import { AppHeader } from '../../src/ui/AppHeader';

export default function FeedTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [scope, setScope] = useState<FeedScope>('foryou');

  function changeScope(s: FeedScope) {
    if (s === 'following' && !user) {
      router.push('/(auth)/welcome');
      return;
    }
    setScope(s);
  }

  return (
    <View style={styles.root}>
      <AppHeader />
      <FeedTabs scope={scope} onChange={changeScope} showFollowing />
      <Feed scope={scope} onOpenDesign={(id) => router.push(`/design/${id}`)} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink } });
