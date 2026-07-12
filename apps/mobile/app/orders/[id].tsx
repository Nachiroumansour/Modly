import type { OrderStatus, PaymentStatus } from '@moodly/shared';
import { PAYMENT_STATUSES } from '@moodly/shared';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { useOrder, useOrderManage } from '../../src/orders/hooks';
import { PAYMENT_LABELS, STATUS_LABELS, formatPrice, nextStatus } from '../../src/orders/labels';
import { StatusChip } from '../../src/orders/StatusChip';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { Button } from '../../src/ui/Button';
import { ErrorRetry } from '../../src/ui/ErrorRetry';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { order, isLoading, isError, refetch } = useOrder(id);
  const manage = useOrderManage(id);
  const [priceInput, setPriceInput] = useState('');

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError || !order) {
    return (
      <View style={[styles.root, styles.center]}>
        <ErrorRetry message="Commande introuvable." onRetry={refetch} dark />
      </View>
    );
  }

  const isOwnerTailor = user?.role === 'TAILLEUR' && user.id === order.tailor.id;
  const next = nextStatus(order.status);
  const terminal = order.status === 'LIVREE' || order.status === 'ANNULEE';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.textOnDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Commande</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.hero}>
          {order.design ? (
            <Image source={{ uri: order.design.imageUrl }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Feather name="scissors" size={22} color={colors.textOnDarkMuted} />
            </View>
          )}
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>{order.design?.title ?? 'Commande sur mesure'}</Text>
            <Text style={styles.heroParty}>
              {user?.role === 'TAILLEUR' ? order.client.name : order.tailor.name}
            </Text>
            <View style={{ marginTop: spacing.sm }}>
              <StatusChip status={order.status} />
            </View>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Info label="Prix" value={formatPrice(order.agreedPrice)} />
          <Info label="Paiement" value={PAYMENT_LABELS[order.paymentStatus]} />
        </View>

        {order.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Demande du client</Text>
            <Text style={styles.noteText}>{order.note}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Suivi</Text>
        <View style={styles.timeline}>
          {order.events.map((e, i) => (
            <View key={e.id} style={styles.event}>
              <View style={styles.eventMarker}>
                <View style={[styles.eventDot, i === order.events.length - 1 && styles.eventDotActive]} />
                {i < order.events.length - 1 ? <View style={styles.eventLine} /> : null}
              </View>
              <View style={styles.eventBody}>
                <Text style={styles.eventStatus}>{STATUS_LABELS[e.status]}</Text>
                <Text style={styles.eventDate}>{formatDate(e.createdAt)}</Text>
                {e.note ? <Text style={styles.eventNote}>{e.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        {isOwnerTailor ? (
          <View style={styles.manage}>
            <Text style={styles.sectionTitle}>Gérer la commande</Text>

            {!terminal && next ? (
              <Button
                label={`Passer à : ${STATUS_LABELS[next]}`}
                onPress={() => manage.setStatus(next)}
                loading={manage.statusPending}
              />
            ) : null}

            <View style={styles.priceRow}>
              <TextInput
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder={order.agreedPrice ? String(order.agreedPrice) : 'Prix en FCFA'}
                placeholderTextColor={colors.textOnDarkMuted}
                keyboardType="number-pad"
                style={styles.priceInput}
              />
              <Pressable
                style={styles.priceSave}
                onPress={() => {
                  const n = Number(priceInput);
                  if (Number.isFinite(n) && n >= 0) manage.updateOrder({ agreedPrice: n });
                }}
              >
                <Text style={styles.priceSaveText}>Fixer le prix</Text>
              </Pressable>
            </View>

            <Text style={styles.smallLabel}>Paiement</Text>
            <View style={styles.segment}>
              {PAYMENT_STATUSES.map((p: PaymentStatus) => (
                <Pressable
                  key={p}
                  style={[styles.segItem, order.paymentStatus === p && styles.segItemActive]}
                  onPress={() => manage.updateOrder({ paymentStatus: p })}
                >
                  <Text style={[styles.segText, order.paymentStatus === p && styles.segTextActive]}>
                    {PAYMENT_LABELS[p]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {!terminal ? (
              <Pressable style={styles.cancel} onPress={() => manage.setStatus('ANNULEE' as OrderStatus)}>
                <Feather name="x-circle" size={18} color={colors.danger} />
                <Text style={styles.cancelText}>Annuler la commande</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 17 },
  hero: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  thumb: { width: 84, height: 104, borderRadius: radius.md, backgroundColor: colors.inkLine },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  heroBody: { flex: 1, justifyContent: 'center' },
  heroTitle: { color: colors.textOnDark, fontFamily: fonts.displayBold, fontSize: 22 },
  heroParty: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 2 },
  infoRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  info: { flex: 1, backgroundColor: colors.inkElevated, borderRadius: radius.md, padding: spacing.md },
  infoLabel: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 16, marginTop: 4 },
  noteBox: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.inkElevated, borderRadius: radius.md, padding: spacing.md },
  noteLabel: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  noteText: { color: colors.textOnDark, fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 21 },
  sectionTitle: {
    color: colors.textOnDark,
    fontFamily: fonts.bodyHeavy,
    fontSize: 16,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  timeline: { paddingHorizontal: spacing.lg },
  event: { flexDirection: 'row', gap: spacing.md },
  eventMarker: { alignItems: 'center', width: 16 },
  eventDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.inkLine, marginTop: 3 },
  eventDotActive: { backgroundColor: colors.accent },
  eventLine: { flex: 1, width: 2, backgroundColor: colors.inkLine, marginVertical: 2 },
  eventBody: { flex: 1, paddingBottom: spacing.lg },
  eventStatus: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15 },
  eventDate: { color: colors.textOnDarkMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  eventNote: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, fontSize: 13, marginTop: 4 },
  manage: { marginTop: spacing.md, paddingBottom: spacing.lg },
  priceRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  priceInput: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  priceSave: {
    paddingHorizontal: spacing.lg,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.inkElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceSaveText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 14 },
  smallLabel: {
    color: colors.textOnDarkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  segment: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  segItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.inkElevated,
    alignItems: 'center',
  },
  segItemActive: { backgroundColor: colors.accentSoft },
  segText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 12, textAlign: 'center' },
  segTextActive: { color: colors.accent },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkLine,
  },
  cancelText: { color: colors.danger, fontFamily: fonts.bodyBold, fontSize: 15 },
});
