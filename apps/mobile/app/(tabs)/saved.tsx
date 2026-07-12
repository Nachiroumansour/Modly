import { useAuth } from '../../src/auth/AuthContext';
import { ComingSoon } from '../../src/ui/ComingSoon';

export default function SavedTab() {
  const { user } = useAuth();
  const isTailor = user?.role === 'TAILLEUR';
  return isTailor ? (
    <ComingSoon
      icon="users"
      title="Mes clients"
      subtitle="Tes fiches clients et leurs 15 mesures, à portée de main. Bientôt dans l'app."
    />
  ) : (
    <ComingSoon
      icon="bookmark"
      title="Sauvegardés"
      subtitle="Retrouve ici tous les modèles que tu mets de côté pour plus tard."
    />
  );
}
