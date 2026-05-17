import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { useI18n } from '../lib/i18n';

export default function WishlistButton({ gameId, className = '' }: { gameId: number; className?: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    window.api.wishlistHas({ userId: user.id, gameId }).then(setOn);
  }, [user?.id, gameId]);

  if (!user) return null;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    try {
      const r = await window.api.wishlistToggle({ userId: user!.id, gameId });
      setOn(r.added);
      toast.success(r.added ? 'Añadido a deseados' : 'Quitado de deseados');
    } finally { setPending(false); }
  }

  return (
    <button
      onClick={toggle}
      className={`btn ${on ? 'btn-primary' : 'btn-secondary'} text-sm ${className}`}
      title={on ? t('detail.wishlist_remove') : t('detail.wishlist_add')}
    >
      <Heart size={15} className={on ? 'fill-current' : ''} />
      {on ? t('detail.wishlist_remove') : t('detail.wishlist_add')}
    </button>
  );
}
