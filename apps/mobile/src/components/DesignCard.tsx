import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import type { Design } from '../types';

type Props = {
  design: Design;
  onPress: () => void;
};

// Carte façon Pinterest : l'image arrondie EST la carte, petit titre sobre dessous.
export function DesignCard({ design, onPress }: Props) {
  const ratio = design.imageWidth / design.imageHeight;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image
        testID="design-image"
        source={{ uri: design.imageUrl }}
        style={[styles.image, { aspectRatio: ratio }]}
        contentFit="cover"
        transition={180}
      />
      <Text style={styles.title} numberOfLines={1}>
        {design.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  pressed: { opacity: 0.92 },
  image: {
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
});
