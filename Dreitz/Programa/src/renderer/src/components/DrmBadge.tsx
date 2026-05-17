const DRM_INFO: Record<string, { label: string; color: string }> = {
  steam: { label: 'Steam Key', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  epic: { label: 'Epic Key', color: 'bg-zinc-700/40 text-zinc-200 border-zinc-500/40' },
  gog: { label: 'GOG Key', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  standalone: { label: 'Standalone', color: 'bg-green-500/20 text-green-300 border-green-500/40' }
};

export default function DrmBadge({ drm = 'steam', size = 'md' }: { drm?: string; size?: 'sm' | 'md' }) {
  const info = DRM_INFO[drm] ?? DRM_INFO.steam;
  const cls = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`inline-block rounded font-bold uppercase border ${info.color} ${cls}`}>
      {info.label}
    </span>
  );
}
