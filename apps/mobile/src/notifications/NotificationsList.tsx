import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUri } from '../lib/config';
import { colors, fonts, radius, spacing } from '../theme';
import type { ApiNotification } from '../types';
import { notificationText } from './render';

export function NotificationsList({
  notifications,
  onPress,
}: {
  notifications: ApiNotification[];
  onPress: (n: ApiNotification) => void;
}) {
  return (
    <FlatList
      data={notifications}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ paddingVertical: spacing.sm }}
      renderItem={({ item }) => (
        <Pressable testID={`notif-row-${item.id}`} style={styles.row} onPress={() => onPress(item)}>
          {item.lastActor?.avatarUrl ? (
            <Image source={{ uri: imageUri(item.lastActor.avatarUrl) }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{item.lastActor?.name?.[0] ?? '?'}</Text>
            </View>
          )}
          <Text style={styles.text}>{notificationText(item)}</Text>
          {item.design ? (
            <Image source={{ uri: imageUri(item.design.imageUrl) }} style={styles.thumb} />
          ) : null}
          {!item.read ? <View testID={`notif-unread-${item.id}`} style={styles.dot} /> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.inkElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 18 },
  text: { flex: 1, color: colors.textOnDark, fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 20 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
