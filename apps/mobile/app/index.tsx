import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Moodly</Text>
      <Text style={styles.subtitle}>Le feed arrive…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d0d',
  },
  title: { color: '#fff', fontSize: 40, fontWeight: '800' },
  subtitle: { color: '#9a9a9a', fontSize: 16, marginTop: 8 },
});
