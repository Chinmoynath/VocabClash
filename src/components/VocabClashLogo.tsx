import React, { useState } from 'react';

interface VocabClashLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
}

export const VocabClashLogo: React.FC<VocabClashLogoProps> = ({ 
  className = '', 
  size = 'md',
  alt = 'VocabClash'
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const dimension = sizeMap[size] || 'w-10 h-10';

  if (!imgError) {
    return (
      <img
        src="/icon-512.png"
        alt={alt}
        className={`inline-block object-cover rounded-2xl shadow-lg border border-indigo-400/30 shrink-0 ${dimension} ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl overflow-hidden shadow-lg border border-indigo-400/40 bg-[#0d0f2b] ${dimension} ${className}`}
      title="VocabClash App Icon"
    >
      <img
        src="/favicon.png"
        alt={alt}
        className="w-full h-full object-cover rounded-2xl"
      />
    </div>
  );
};

