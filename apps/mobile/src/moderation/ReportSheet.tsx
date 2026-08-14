import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useReport } from './hooks';
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from './reasons';

type Props = {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
};

export function ReportSheet({ visible, targetType, targetId, onClose }: Props) {
  const { report, sending } = useReport();

  async function choose(reason: ReportReason) {
    try {
      await report({ targetType, targetId, reason });
    } finally {
      onClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Signaler</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r.value}
              style={styles.row}
              disabled={sending}
              onPress={() => choose(r.value)}
            >
              <Text style={styles.rowText}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.inkElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  title: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17, marginBottom: spacing.md },
  row: { paddingVertical: spacing.md },
  rowText: { color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
});
