import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EFE9DD] to-[#E6DEC8] p-4 text-center text-[#6E5B4F] ${className}`}
        role="img"
        aria-label={alt}
      >
        <Sparkles className="mb-2 h-6 w-6 text-[#B08D57]" />
        <span className="line-clamp-2 font-serif-editorial text-sm italic text-[#3B281E]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
