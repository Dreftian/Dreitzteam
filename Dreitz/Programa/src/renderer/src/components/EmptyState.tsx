import type { ReactNode } from 'react';
import {
  IllustrationCart,
  IllustrationLibrary,
  IllustrationWishlist,
  IllustrationFriends,
  IllustrationSearchEmpty,
  IllustrationError
} from './Illustrations';

interface Props {
  icon?: ReactNode;
  illustration?: 'library' | 'cart' | 'wishlist' | 'search' | 'friends' | 'error';
  title: string;
  body?: string;
  cta?: ReactNode;
}

function Illustration({ kind }: { kind: NonNullable<Props['illustration']> }) {
  const cls = 'w-44 h-36';
  switch (kind) {
    case 'cart':     return <IllustrationCart className={cls} />;
    case 'library':  return <IllustrationLibrary className={cls} />;
    case 'wishlist': return <IllustrationWishlist className={cls} />;
    case 'friends':  return <IllustrationFriends className={cls} />;
    case 'error':    return <IllustrationError className={cls} />;
    case 'search':
    default:         return <IllustrationSearchEmpty className={cls} />;
  }
}

export default function EmptyState({ icon, illustration, title, body, cta }: Props) {
  return (
    <div className="card p-10 text-center flex flex-col items-center">
      {icon ? <div className="mb-4 text-fg-muted">{icon}</div> : null}
      {illustration ? <div className="mb-4"><Illustration kind={illustration} /></div> : null}
      <h3 className="text-h3 mb-2">{title}</h3>
      {body && <p className="text-sm text-fg-muted mb-5 max-w-md">{body}</p>}
      {cta}
    </div>
  );
}
