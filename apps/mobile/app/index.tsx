import { useRouter } from 'expo-router';
import { Feed } from '../src/feed/Feed';

export default function Home() {
  const router = useRouter();
  return <Feed onOpenDesign={(id) => router.push(`/design/${id}`)} />;
}
