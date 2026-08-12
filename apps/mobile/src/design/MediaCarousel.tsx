import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { imageUri } from '../lib/config';
import { colors, spacing } from '../theme';
import type { Media } from '../types';

type Item = { url: string; width: number; height: number; blurhash: string | null };
type Props = {
  media: Media[];
  cover: Item;
  onDoubleTapLike?: () => void;
};

export function MediaCarousel({ media, cover, onDoubleTapLike }: Props) {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const lastTap = useRef(0);

  const items: Item[] = media.length > 0 ? media : [cover];
  const ratio = items[0].width / items[0].height;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setActive(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function onTap() {
    const now = Date.now();
    if (now - lastTap.current < 280) onDoubleTapLike?.();
    lastTap.current = now;
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {items.map((it, i) => (
          <Pressable key={i} onPress={onTap}>
            <Image
              testID="carousel-page"
              source={{ uri: imageUri(it.url) }}
              placeholder={it.blurhash ? { blurhash: it.blurhash } : undefined}
              style={{ width, aspectRatio: ratio, backgroundColor: colors.inkElevated }}
              contentFit="cover"
              transition={180}
            />
          </Pressable>
        ))}
      </ScrollView>
      {items.length > 1 ? (
        <View testID="carousel-dots" style={styles.dots}>
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(246,241,233,0.5)' },
  dotActive: { backgroundColor: colors.textOnDark, width: 7, height: 7, borderRadius: 3.5 },
});
