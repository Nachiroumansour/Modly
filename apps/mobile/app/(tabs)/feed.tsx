import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Feed } from '../../src/feed/Feed';
import { AppHeader } from '../../src/ui/AppHeader';
import { colors } from '../../src/theme';

export default function FeedTab() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <AppHeader />
      <Feed onOpenDesign={(id) => router.push(`/design/${id}`)} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink } });
