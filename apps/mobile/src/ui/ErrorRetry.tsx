import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { Button } from './Button';

type Props = {
  message?: string;
  onRetry: () => void;
  dark?: boolean;
};

export function ErrorRetry({ message, onRetry, dark }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, dark && styles.textDark]}>
        {message ?? 'Une erreur est survenue.'}
      </Text>
      <Button label="Réessayer" onPress={onRetry} variant={dark ? 'primary' : 'ghost'} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  text: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' },
  textDark: { color: colors.textOnDarkMuted },
});
