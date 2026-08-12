import { Feather } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import type { Comment } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  comments: Comment[];
  commentText: string;
  setCommentText: (t: string) => void;
  submitComment: () => void;
  commenting: boolean;
  authed: boolean;
  onRequireAuth: () => void;
};

export function CommentsSheet({
  visible,
  onClose,
  comments,
  commentText,
  setCommentText,
  submitComment,
  commenting,
  authed,
  onRequireAuth,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable testID="comments-backdrop" style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Commentaires</Text>
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.lg }}>
              {comments.length === 0 ? (
                <Text style={styles.empty}>Sois le premier a commenter.</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.comment}>
                    <Text style={styles.author}>{c.user.name}</Text>
                    <Text style={styles.text}>{c.text}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            {authed ? (
              <View style={styles.inputRow}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Ecris un commentaire..."
                  placeholderTextColor={colors.textOnDarkMuted}
                  style={styles.input}
                  multiline
                />
                <Pressable
                  testID="comment-send"
                  onPress={submitComment}
                  disabled={commenting}
                  style={styles.send}
                >
                  <Feather name="send" size={18} color={colors.textOnDark} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={onRequireAuth} style={styles.gate}>
                <Text style={styles.gateText}>Connecte-toi pour commenter</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { maxHeight: '82%' },
  sheet: {
    backgroundColor: colors.inkElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inkLine,
    marginBottom: spacing.md,
  },
  title: { color: colors.textOnDark, fontFamily: fonts.bodyHeavy, fontSize: 16, marginBottom: spacing.md },
  list: { maxHeight: 380 },
  empty: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, paddingVertical: spacing.md },
  comment: { marginBottom: spacing.lg },
  author: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 13 },
  text: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyRegular, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    color: colors.textOnDark,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gate: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inkLine,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  gateText: { color: colors.textOnDarkMuted, fontFamily: fonts.bodyBold, fontSize: 14 },
});
