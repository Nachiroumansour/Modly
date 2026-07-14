import { Feather } from '@expo/vector-icons';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
};

/** Onglet central en relief (façon Insta) : pastille ronde accent + label dessous. */
export function CenterTabButton({ icon, label, onPress }: Props) {
  return (
    <Pressable style={styles.wrap} onPress={onPress} accessibilityRole="button">
      <View style={styles.circle}>
        <Feather name={icon} size={24} color={colors.textOnDark} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 11, marginTop: 4 },
});
