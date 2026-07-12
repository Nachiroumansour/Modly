import type { OrderStatus } from '@moodly/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { STATUS_LABELS } from './labels';

export function StatusChip({ status }: { status: OrderStatus }) {
  const tone =
    status === 'ANNULEE'
      ? { bg: 'rgba(178,63,46,0.15)', fg: colors.danger }
      : status === 'LIVREE'
        ? { bg: colors.accentSoft, fg: colors.accent }
        : { bg: colors.inkElevated, fg: colors.textOnDark };
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      {status !== 'ANNULEE' && status !== 'LIVREE' ? <View style={styles.dot} /> : null}
      <Text style={[styles.text, { color: tone.fg }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  text: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
