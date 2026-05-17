import { useEffect, useState } from 'react';
import { Award, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/format';
import { useI18n } from '../lib/i18n';

interface AchRow {
  code: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export default function AchievementsList() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [list, setList] = useState<AchRow[]>([]);

  useEffect(() => {
    if (!user) return;
    window.api.achievementsList(user.id).then(setList);
  }, [user?.id]);

  if (!list.length) return <div className="text-fg-muted text-sm">{t('common.loading')}</div>;
  const unlocked = list.filter((a) => a.unlocked).length;

  return (
    <div>
      <div className="text-xs text-fg-subtle mb-3">{unlocked} / {list.length} desbloqueados</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((a) => (
          <div
            key={a.code}
            className={`card p-4 flex gap-3 items-start transition-all ${a.unlocked ? 'border-accent/30' : 'opacity-60'}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.unlocked ? 'bg-accent/15 text-accent' : 'bg-bg-hover text-fg-subtle'}`}>
              {a.unlocked ? <Award size={18} /> : <Lock size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{a.title}</div>
              <div className="text-xs text-fg-muted line-clamp-2">{a.description}</div>
              {a.unlocked && a.unlocked_at && (
                <div className="text-[10px] text-fg-subtle mt-1.5">{t('achievements.unlocked')} · {formatDate(a.unlocked_at)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
