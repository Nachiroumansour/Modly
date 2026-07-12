import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import type { Design } from '../types';

type Props = {
  design: Design;
  onPress: () => void;
};

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
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {design.title}
        </Text>
        <Text style={styles.tailor} numberOfLines={1}>
          {design.tailor.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceWarm,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.9 },
  image: { width: '100%', backgroundColor: colors.border },
  meta: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  title: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 14 },
  tailor: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
