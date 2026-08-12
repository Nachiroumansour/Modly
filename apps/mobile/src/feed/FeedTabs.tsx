import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import type { FeedScope } from './useFeed';

type Props = {
  scope: FeedScope;
  onChange: (scope: FeedScope) => void;
  showFollowing: boolean;
};

export function FeedTabs({ scope, onChange, showFollowing }: Props) {
  return (
    <View style={styles.row}>
      <Tab label="Pour vous" active={scope === 'foryou'} onPress={() => onChange('foryou')} testID="tab-foryou" />
      {showFollowing ? (
        <Tab label="Abonnements" active={scope === 'following'} onPress={() => onChange('following')} testID="tab-following" />
      ) : null}
    </View>
  );
}

function Tab({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  tab: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.inkElevated },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
  tabTextActive: { color: colors.textOnDark },
});
