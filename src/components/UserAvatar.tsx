import React from 'react';

interface UserAvatarProps {
  avatarUrl?: string;
  displayName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const PRESET_STYLES: Record<string, string> = {
  'obsidian-cyan': 'bg-gradient-to-br from-[#06B6D4] to-[#0E7490] text-[#090A0F]',
  'cobalt-pulse': 'bg-gradient-to-br from-[#38BDF8] to-[#1D4ED8] text-white',
  'emerald-node': 'bg-gradient-to-br from-[#10B981] to-[#047857] text-[#090A0F]',
  'violet-vector': 'bg-gradient-to-br from-[#A78BFA] to-[#6D28D9] text-white',
  'amber-signal': 'bg-gradient-to-br from-[#FBBF24] to-[#B45309] text-[#090A0F]',
  'slate-minimal': 'bg-gradient-to-br from-[#475569] to-[#1E293B] text-white',
};

const SIZE_CLASSES = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl = 'obsidian-cyan',
  displayName = 'User',
  size = 'md',
}) => {
  const [imgError, setImgError] = React.useState(false);
  const safeName = typeof displayName === 'string' && displayName ? displayName : 'User';
  const safeAvatar = typeof avatarUrl === 'string' && avatarUrl ? avatarUrl : 'obsidian-cyan';

  const initials = React.useMemo(() => {
    const parts = safeName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }
    return (safeName.slice(0, 2) || 'CI').toUpperCase();
  }, [safeName]);

  const isExternalUrl =
    (safeAvatar.startsWith('http://') ||
      safeAvatar.startsWith('https://') ||
      safeAvatar.startsWith('data:image/')) &&
    !imgError;

  const presetStyle = PRESET_STYLES[safeAvatar] || PRESET_STYLES['obsidian-cyan'];

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-2xl shrink-0 flex items-center justify-center font-bold tracking-tight overflow-hidden border border-white/10 select-none ${
        isExternalUrl ? 'bg-[#11131C]' : presetStyle
      }`}
    >
      {isExternalUrl ? (
        <img
          src={safeAvatar}
          alt={`${safeName} avatar`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
