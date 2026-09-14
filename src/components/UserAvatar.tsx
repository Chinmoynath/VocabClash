import React, { useState, useEffect } from 'react';

interface UserAvatarProps {
  photoURL?: string | null;
  avatar?: string;
  name?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  alt?: string;
}

/**
 * Universal UserAvatar component that renders Google Photo if available,
 * and gracefully falls back to emoji avatar if missing or if image fails to load.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  avatar = '👨‍💼',
  name = 'Avatar',
  className = 'w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0 overflow-hidden',
  imgClassName = 'w-full h-full object-cover',
  fallbackClassName = '',
  alt,
}) => {
  const [hasError, setHasError] = useState<boolean>(false);

  // Reset error state if photoURL changes
  useEffect(() => {
    setHasError(false);
  }, [photoURL]);

  if (photoURL && photoURL.trim() && !hasError) {
    return (
      <div className={`${className} overflow-hidden`}>
        <img
          src={photoURL}
          alt={alt || name}
          referrerPolicy="no-referrer"
          className={imgClassName}
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <span className={fallbackClassName}>{avatar || '👨‍💼'}</span>
    </div>
  );
};
