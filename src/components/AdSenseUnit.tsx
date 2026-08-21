import React, { useEffect, useRef } from 'react';
import { 
  ADSENSE_CLIENT_ID, 
  ADSENSE_BANNER_SLOT, 
  initGoogleAdSense 
} from '../services/adSenseService';

interface AdSenseUnitProps {
  slotId?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  className?: string;
  responsive?: boolean;
  isPremium?: boolean;
  onAdClick?: () => void;
}

export const AdSenseUnit: React.FC<AdSenseUnitProps> = ({
  slotId = ADSENSE_BANNER_SLOT,
  format = 'auto',
  className = '',
  responsive = true,
  isPremium = false,
}) => {
  if (isPremium) {
    return null;
  }

  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef<boolean>(false);

  useEffect(() => {
    // Ensure Google AdSense script is injected
    initGoogleAdSense();

    const timer = setTimeout(() => {
      try {
        if (
          adRef.current && 
          !pushedRef.current &&
          !adRef.current.getAttribute('data-adsbygoogle-status')
        ) {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          pushedRef.current = true;
        }
      } catch (e) {
        // TagError happens if already filled or in sandbox
        console.warn('AdSense slot request notice:', e);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [slotId]);

  return (
    <div className={`w-full overflow-hidden flex flex-col items-center justify-center relative ${className}`}>
      {/* Real Google AdSense Slot */}
      <div className="w-full flex justify-center items-center relative">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
        />
      </div>
    </div>
  );
};

