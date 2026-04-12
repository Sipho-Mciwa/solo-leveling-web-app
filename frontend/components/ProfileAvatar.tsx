interface ProfileAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
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

export default function ProfileAvatar({ photoURL, displayName, email }: ProfileAvatarProps) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={displayName ?? 'Profile'}
        className="w-20 h-20 rounded-full object-cover border-2 border-accent/30"
        referrerPolicy="no-referrer"
      />
    );
  }

  const initials = getInitials(displayName, email);

  return (
    <div className="w-20 h-20 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
      <span className="text-2xl font-bold text-accent-light select-none">{initials}</span>
    </div>
  );
}
