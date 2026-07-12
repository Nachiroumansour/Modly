import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setOnboarded } from '../src/auth/storage';
import { colors, fonts, radius, spacing } from '../src/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    image: require('../assets/onboarding/1.png'),
    eyebrow: 'BIENVENUE',
    title: 'Ta mode, inspirée',
    text: 'Découvre les plus beaux modèles des tailleurs sénégalais, comme un feed sans fin.',
  },
  {
    image: require('../assets/onboarding/2.png'),
    eyebrow: 'SIMPLE',
    title: 'Commande en un geste',
    text: 'Choisis un modèle, tes mesures, ton tailleur — et suis la confection en direct.',
  },
  {
    image: require('../assets/onboarding/3.png'),
    eyebrow: 'COMMUNAUTÉ',
    title: 'Le futur de la mode africaine',
    text: 'Rejoins les créateurs et les passionnés qui réinventent le vêtement.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  async function finish() {
    await setOnboarded();
    router.replace('/(tabs)/feed');
  }

  function next() {
    if (last) return finish();
    scroller.current?.scrollTo({ x: width * (index + 1), animated: true });
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <Image source={s.image} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.scrim} />
            <View style={[styles.content, { paddingBottom: insets.bottom + 150 }]}>
              <Text style={styles.eyebrow}>{s.eyebrow}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.text}>{s.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable onPress={finish} style={[styles.skip, { top: insets.top + spacing.md }]} hitSlop={12}>
        <Text style={styles.skipText}>Passer</Text>
      </Pressable>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={next} style={styles.cta}>
          <Text style={styles.ctaText}>{last ? 'Commencer' : 'Suivant'}</Text>
          <Feather name="arrow-right" size={20} color={colors.textOnDark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  slide: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,10,7,0.32)' },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.xl },
  eyebrow: {
    color: colors.accent,
    fontFamily: fonts.bodyHeavy,
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 44,
    marginBottom: spacing.md,
  },
  text: {
    color: colors.textOnDark,
    fontFamily: fonts.bodyRegular,
    fontSize: 17,
    lineHeight: 25,
    opacity: 0.92,
    maxWidth: 320,
  },
  skip: { position: 'absolute', right: spacing.xl },
  skipText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 15, opacity: 0.85 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(246,241,233,0.35)' },
  dotActive: { width: 22, backgroundColor: colors.accent },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingLeft: spacing.xl,
    paddingRight: spacing.lg,
    height: 56,
    borderRadius: radius.pill,
  },
  ctaText: { color: colors.textOnDark, fontFamily: fonts.bodyBold, fontSize: 16 },
});
