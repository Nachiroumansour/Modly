import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { formatPrice } from '../../src/orders/labels';
import { StatusChip } from '../../src/orders/StatusChip';
import { useOrders } from '../../src/orders/hooks';
import { colors, fonts, radius, spacing } from '../../src/theme';
import type { Order } from '../../src/types';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

export default function OrdersTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders, isLoading, isError, refetch } = useOrders();
  const isTailor = user?.role === 'TAILLEUR';

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={[styles.root, styles.center]}>
        <ErrorRetry message="Impossible de charger les commandes." onRetry={refetch} dark />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{isTailor ? 'Commandes reçues' : 'Mes commandes'}</Text>
      {orders.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.badge}>
            <Feather name="shopping-bag" size={26} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>
            {isTailor
              ? 'Les commandes de tes clients apparaîtront ici.'
              : 'Commande un modèle depuis le feed pour suivre sa confection ici.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} showTailor={!isTailor} onPress={() => router.push(`/orders/${o.id}`)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function OrderRow({ order, showTailor, onPress }: { order: Order; showTailor: boolean; onPress: () => void }) {
  const party = showTailor ? order.tailor.name : order.client.name;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {order.design ? (
        <Image source={{ uri: order.design.imageUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Feather name="scissors" size={20} color={colors.textOnDarkMuted} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {order.design?.title ?? 'Commande sur mesure'}
        </Text>
        <Text style={styles.rowParty} numberOfLines={1}>
          {showTailor ? 'Tailleur · ' : 'Client · '}
          {party}
        </Text>
        <View style={styles.rowFooter}>
          <StatusChip status={order.status} />
          <Text style={styles.price}>{formatPrice(order.agreedPrice)}</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textOnDarkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 30, marginBottom: spacing.lg },
  list: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.inkElevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  thumb: { width: 60, height: 72, borderRadius: radius.sm, backgroundColor: colors.inkLine },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
  rowParty: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 13 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  price: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 13 },
  empty: { alignItems: 'center', marginTop: spacing.xxl * 2, gap: spacing.md, paddingHorizontal: spacing.xl },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.inkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
});
