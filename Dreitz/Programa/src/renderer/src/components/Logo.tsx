import { type CSSProperties } from 'react';
import tianLogo from '../assets/tian.png';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const MARK_PX: Record<Size, number> = { xs: 20, sm: 26, md: 34, lg: 52, xl: 92 };
const WORD_PX: Record<Size, number> = { xs: 14, sm: 18, md: 22, lg: 32, xl: 48 };

export function LogoMark({
  size = 'md',
  mono = false,
  animated = false,
  className = '',
  style
}: {
  size?: Size;
  mono?: boolean;
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const px = MARK_PX[size];

  return (
    <img
      src={tianLogo}
      width={px}
      height={px}
      alt="Dreitz"
      className={`${className} ${animated ? 'logo-bob' : ''} rounded-full bg-black object-contain ring-1 ring-white/10 shadow-[0_0_14px_rgba(143,48,54,0.35)]`}
      style={{
        width: px,
        height: px,
        filter: mono ? 'grayscale(1) brightness(1.45)' : undefined,
        ...style
      }}
      draggable={false}
    />
  );
}

export function LogoWordmark({
  size = 'md',
  mono = false,
  className = ''
}: {
  size?: Size;
  mono?: boolean;
  className?: string;
}) {
  const px = WORD_PX[size];
  return (
    <span
      className={`${className} ${mono ? '' : 'shimmer-text'} font-display`}
      style={{
        fontSize: `${px}px`,
        fontWeight: 800,
        letterSpacing: '-0.04em',
        lineHeight: 1,
        color: mono ? 'currentColor' : undefined
      }}
    >
      Dreitz
    </span>
  );
}

export default function Logo({
  size = 'md',
  mono = false,
  animated = false,
  showTagline = false,
  layout = 'horizontal',
  className = ''
}: {
  size?: Size;
  mono?: boolean;
  animated?: boolean;
  showTagline?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
}) {
  return (
    <div
      className={`${className} inline-flex ${layout === 'vertical' ? 'flex-col items-center text-center' : 'items-center'} gap-${layout === 'vertical' ? '2' : '2.5'}`}
    >
      <LogoMark size={size} mono={mono} animated={animated} />
      <div className="flex flex-col">
        <LogoWordmark size={size} mono={mono} />
        {showTagline && (
          <span className="text-eyebrow mt-1" style={{ letterSpacing: '0.32em' }}>
            DREITZTEAM
          </span>
        )}
      </div>
    </div>
  );
}
