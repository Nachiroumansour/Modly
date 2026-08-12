import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';

type Props = {
  liked: boolean;
  saved: boolean;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
};

export function SocialActionBar({
  liked,
  saved,
  likesCount,
  commentsCount,
  bookmarksCount,
  onLike,
  onComment,
  onShare,
  onSave,
}: Props) {
  return (
    <View style={styles.row}>
      <Pressable testID="action-like" style={styles.action} onPress={onLike}>
        <Feather name="heart" size={22} color={liked ? colors.accent : colors.textOnDark} />
        <Text style={styles.count}>{likesCount}</Text>
      </Pressable>
      <Pressable testID="action-comment" style={styles.action} onPress={onComment}>
        <Feather name="message-circle" size={22} color={colors.textOnDark} />
        <Text style={styles.count}>{commentsCount}</Text>
      </Pressable>
      <Pressable testID="action-share" style={styles.action} onPress={onShare}>
        <Feather name="share" size={22} color={colors.textOnDark} />
      </Pressable>
      <View style={styles.spacer} />
      <Pressable testID="action-save" style={styles.action} onPress={onSave}>
        <Feather name="bookmark" size={22} color={saved ? colors.accent : colors.textOnDark} />
        <Text style={styles.count}>{bookmarksCount}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 14 },
  spacer: { flex: 1 },
});
