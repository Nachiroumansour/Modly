import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type Props = TextInputProps & {
  label: string;
};

export function TextField({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textOnDarkMuted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    color: colors.textOnDarkMuted,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    color: colors.textOnDark,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body.fontSize,
  },
});
