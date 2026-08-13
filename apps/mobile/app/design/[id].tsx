import { useLocalSearchParams, useRouter } from 'expo-router';
import { DesignScreen } from '../../src/design/DesignScreen';

export default function DesignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <DesignScreen
      id={id}
      onBack={() => router.back()}
      onRequireAuth={() => router.push('/(auth)/welcome')}
      onOrder={() => router.push(`/order/create?designId=${id}`)}
      onTailor={(tailorId) => router.push(`/tailor/${tailorId}`)}
      onOpenDesign={(sid) => router.push(`/design/${sid}`)}
    />
  );
}
