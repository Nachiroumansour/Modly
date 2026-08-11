import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DesignCard } from '../components/DesignCard';
import { spacing } from '../theme';
import type { Design } from '../types';

/** Répartit les modèles en 2 colonnes en équilibrant la hauteur (masonry Pinterest). */
export function splitColumns(designs: Design[]): [Design[], Design[]] {
  const cols: [Design[], Design[]] = [[], []];
  const heights = [0, 0];
  for (const d of designs) {
    const target = heights[0] <= heights[1] ? 0 : 1;
    cols[target].push(d);
    heights[target] += d.imageHeight / d.imageWidth;
  }
  return cols;
}

export function MasonryColumns({
  designs,
  onOpen,
  onLongPress,
}: {
  designs: Design[];
  onOpen: (id: string) => void;
  onLongPress?: (id: string) => void;
}) {
  const [left, right] = useMemo(() => splitColumns(designs), [designs]);
  return (
    <View style={styles.columns}>
      <View style={styles.column}>
        {left.map((d) => (
          <DesignCard key={d.id} design={d} onPress={() => onOpen(d.id)} onLongPress={onLongPress ? () => onLongPress(d.id) : undefined} />
        ))}
      </View>
      <View style={styles.column}>
        {right.map((d) => (
          <DesignCard key={d.id} design={d} onPress={() => onOpen(d.id)} onLongPress={onLongPress ? () => onLongPress(d.id) : undefined} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: spacing.sm },
  column: { flex: 1 },
});
