import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { useAuthCovers } from './useAuthCovers';

const FALLBACK = require('../../assets/onboarding/1.png');
const { height: SCREEN_H } = Dimensions.get('window');
const BAND_H = Math.round(SCREEN_H * 0.46);
const COLS = 3;
/** Décalage vertical par colonne → effet mosaïque « Pinterest » décalé. */
const OFFSETS = [-24, -64, -12];

/**
 * Bande héro des écrans d'auth : mosaïque de vraies couvertures du feed,
 * assombrie par un scrim, avec le contenu de marque superposé.
 * Repli sur un visuel d'onboarding quand aucune couverture n'est disponible.
 */
export function AuthCollage({ children }: { children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const covers = useAuthCovers(12);

  const columns: string[][] = Array.from({ length: COLS }, () => []);
  covers.forEach((uri, i) => columns[i % COLS].push(uri));

  return (
    <View style={[styles.band, { height: BAND_H + insets.top }]}>
      {covers.length === 0 ? (
        <Image
          testID="auth-collage-fallback"
          source={FALLBACK}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={styles.mosaic}>
          {columns.map((col, i) => (
            <View key={i} style={[styles.column, { marginTop: OFFSETS[i] }]}>
              {col.map((uri, j) => (
                <Image
                  key={`${i}-${j}`}
                  testID="auth-collage-image"
                  source={{ uri }}
                  style={styles.tile}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      <View style={styles.scrim} />
      <View style={[styles.overlay, { paddingTop: insets.top }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { width: '100%', backgroundColor: colors.ink, overflow: 'hidden' },
  mosaic: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  column: { flex: 1, gap: spacing.sm },
  tile: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: colors.inkElevated },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,11,8,0.52)' },
  overlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
});
