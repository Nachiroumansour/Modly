import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useBlock, useBlockedIds, useUnblock } from './hooks';

export function BlockButton({ userId }: { userId: string }) {
  const { isBlocked } = useBlockedIds();
  const { block, blocking } = useBlock();
  const { unblock, unblocking } = useUnblock();
  const blocked = isBlocked(userId);
  return (
    <Pressable
      style={styles.btn}
      disabled={blocking || unblocking}
      onPress={() => (blocked ? unblock(userId) : block(userId))}
    >
      <Text style={styles.text}>{blocked ? 'Débloquer' : 'Bloquer'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.inkLine,
  },
  text: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
});
