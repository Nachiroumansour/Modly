import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useAuth } from '../src/auth/AuthContext';
import { getOnboarded } from '../src/auth/storage';

export default function Index() {
  const { loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    getOnboarded().then(setOnboarded);
  }, []);

  const ready = !loading && fontsLoaded && onboarded !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null; // le splash reste affiché
  return <Redirect href={onboarded ? '/(tabs)/feed' : '/onboarding'} />;
}
