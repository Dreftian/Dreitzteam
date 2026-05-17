import tianLogo from '../assets/tian.png';

export default function BrandMark({
  size = 24,
  className = ''
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={tianLogo}
      alt="Dreitz"
      width={size}
      height={size}
      className={`${className} rounded-full bg-black object-contain ring-1 ring-white/10 shadow-[0_0_14px_rgba(143,48,54,0.35)]`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
