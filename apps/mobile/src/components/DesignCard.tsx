import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUri } from '../lib/config';
import { colors, fonts, radius, spacing } from '../theme';
import type { Design } from '../types';

type Props = {
  design: Design;
  onPress: () => void;
  onLongPress?: () => void;
};

// Carte façon Pinterest : image arrondie = la carte, placeholder flou, badge multi-média.
export function DesignCard({ design, onPress, onLongPress }: Props) {
  const ratio = design.imageWidth / design.imageHeight;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View>
        <Image
          testID="design-image"
          source={{ uri: imageUri(design.imageUrl) }}
          placeholder={design.coverBlurhash ? { blurhash: design.coverBlurhash } : undefined}
          style={[styles.image, { aspectRatio: ratio }]}
          contentFit="cover"
          transition={180}
        />
        {design.mediaCount > 1 ? (
          <View testID="multi-indicator" style={styles.multi}>
            <Feather name="copy" size={13} color={colors.textOnDark} />
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {design.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  pressed: { opacity: 0.92 },
  image: { width: '100%', borderRadius: radius.md, backgroundColor: colors.inkElevated },
  multi: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(23,18,15,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
});
