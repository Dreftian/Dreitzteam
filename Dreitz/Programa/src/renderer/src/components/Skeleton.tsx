export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />;
}

export function GameCardSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const w = size === 'sm' ? 'w-48' : size === 'lg' ? 'w-72' : 'w-56';
  return (
    <div className={`${w} shrink-0 rounded-xl overflow-hidden card`}>
      <Skeleton className="aspect-[460/215] w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
        <Skeleton className="h-4 w-1/3 mt-1" />
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden h-[420px] mb-8 hero-gradient relative">
      <Skeleton className="absolute inset-0 rounded-none opacity-30" />
      <div className="relative p-10 h-full flex flex-col justify-end gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-40 mt-3" />
      </div>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => <GameCardSkeleton key={i} />)}
      </div>
    </section>
  );
}
