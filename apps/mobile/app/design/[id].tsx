import { useLocalSearchParams, useRouter } from 'expo-router';
import { DesignScreen } from '../../src/design/DesignScreen';

export default function DesignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <DesignScreen
      id={id}
      onBack={() => router.back()}
      onRequireAuth={() => router.push('/(auth)/register')}
    />
  );
}
