import Image from 'next/image';

interface ProfileAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: 'sm' | 'lg';
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

const SIZE_PX = { sm: 40, lg: 80 };
const SIZE_CLASSES = {
  sm: 'w-10 h-10',
  lg: 'w-20 h-20',
};
const TEXT_CLASSES = {
  sm: 'text-sm',
  lg: 'text-2xl',
};

export default function ProfileAvatar({ photoURL, displayName, email, size = 'lg' }: ProfileAvatarProps) {
  const px = SIZE_PX[size];

  if (photoURL) {
    return (
      <Image
        src={photoURL}
        alt={displayName ?? 'Profile'}
        width={px}
        height={px}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover border-2 border-accent/30 shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }

  const initials = getInitials(displayName, email);

  return (
    <div className={`${SIZE_CLASSES[size]} rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0`}>
      <span className={`${TEXT_CLASSES[size]} font-bold text-accent-light select-none`}>{initials}</span>
    </div>
  );
}
