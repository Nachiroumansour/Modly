import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MasonryColumns } from '../feed/masonry';
import { colors, fonts, radius, spacing } from '../theme';
import type { Design } from '../types';

type Props = {
  designs: Design[];
  onPublish: () => void;
  onOpenClients: () => void;
  onOpenDesign: (id: string) => void;
};

export function TailorProfileBody({ designs, onPublish, onOpenClients, onOpenDesign }: Props) {
  return (
    <View style={styles.root}>
      <Pressable testID="profile-clients" style={styles.clients} onPress={onOpenClients}>
        <Feather name="users" size={18} color={colors.textOnDark} />
        <Text style={styles.clientsText}>Mes fiches clients</Text>
        <Feather name="chevron-right" size={18} color={colors.textOnDarkMuted} />
      </Pressable>

      <View style={styles.head}>
        <Text style={styles.title}>Mes modèles</Text>
        <Pressable testID="profile-publish" style={styles.publish} onPress={onPublish}>
          <Feather name="plus" size={16} color={colors.textOnDark} />
          <Text style={styles.publishText}>Publier</Text>
        </Pressable>
      </View>

      {designs.length === 0 ? (
        <Text style={styles.empty}>Publie ton premier modèle pour le montrer à la communauté.</Text>
      ) : (
        <MasonryColumns designs={designs} onOpen={onOpenDesign} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  clients: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  clientsText: { flex: 1, color: colors.textOnDark, fontFamily: fonts.body, fontSize: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 24 },
  publish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  publishText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  empty: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.md,
  },
});
