import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUri } from '../lib/config';
import { colors, fonts, radius, spacing } from '../theme';
import { mosaicSlots } from './mosaic';

export function MosaicCover({ covers }: { covers: string[] }) {
  const slots = mosaicSlots(covers);
  if (slots.length === 0) {
    return <View style={[styles.cover, styles.coverEmpty]} />;
  }
  if (slots.length === 1) {
    return <Image source={{ uri: imageUri(slots[0]) }} style={styles.cover} contentFit="cover" />;
  }
  return (
    <View style={[styles.cover, styles.mosaic]}>
      {slots.map((u, i) => (
        <Image key={i} source={{ uri: imageUri(u) }} style={styles.tile} contentFit="cover" />
      ))}
    </View>
  );
}

export function CollectionCard({
  name,
  count,
  covers,
  onPress,
}: {
  name: string;
  count: number;
  covers: string[];
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="collection-card"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <MosaicCover covers={covers} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  pressed: { opacity: 0.92 },
  cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.inkElevated,
  },
  coverEmpty: { backgroundColor: colors.inkElevated },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '50%', height: '50%', backgroundColor: colors.ink },
  name: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15, marginTop: spacing.sm },
  count: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
