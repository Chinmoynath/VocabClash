import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface MistakeVaultScrollBarProps {
  totalItems: number;
  containerId?: string;
  className?: string;
}

export const MistakeVaultScrollBar: React.FC<MistakeVaultScrollBarProps> = ({
  totalItems,
  containerId = 'app-main-content',
  className = '',
}) => {
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isScrollable, setIsScrollable] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);

  const railRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Measure and update scroll state
  const handleScrollUpdate = useCallback(() => {
    const el = document.getElementById(containerId) || document.documentElement;
    if (!el) {
      setIsScrollable(false);
      return;
    }

    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;

    // Only show if there is meaningful scrollable overflow
    const maxScroll = scrollHeight - clientHeight;
    const canScroll = maxScroll > 60 && totalItems > 1;

    setIsScrollable(canScroll);

    if (canScroll && maxScroll > 0) {
      const progress = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
      setScrollProgress(progress);
    } else {
      setScrollProgress(0);
    }
  }, [containerId, totalItems]);

  // Set up listeners and ResizeObserver for immediate update on delete/save/filter changes
  useEffect(() => {
    const el = document.getElementById(containerId);
    handleScrollUpdate();

    const scrollTarget = el || window;
    const onScroll = () => {
      handleScrollUpdate();
      setIsScrolling(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 700);
    };

    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', handleScrollUpdate);

    // Observe DOM mutations & size changes (e.g. deleting words, filtering, saving)
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    if (el) {
      resizeObserver = new ResizeObserver(() => {
        handleScrollUpdate();
      });
      resizeObserver.observe(el);

      mutationObserver = new MutationObserver(() => {
        handleScrollUpdate();
      });
      mutationObserver.observe(el, { childList: true, subtree: true });
    }

    // Safety timeout check
    const timer = setTimeout(handleScrollUpdate, 150);

    return () => {
      scrollTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', handleScrollUpdate);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      clearTimeout(timer);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [containerId, handleScrollUpdate, totalItems]);

  // Scroll to a specific percentage
  const scrollToPercent = (percent: number) => {
    const el = document.getElementById(containerId) || document.documentElement;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;

    const targetTop = (percent / 100) * maxScroll;
    el.scrollTo({
      top: targetTop,
      behavior: 'smooth',
    });
  };

  const handleScrollToTop = (e: React.MouseEvent) => {
    e.stopPropagation();
    scrollToPercent(0);
  };

  const handleScrollToBottom = (e: React.MouseEvent) => {
    e.stopPropagation();
    scrollToPercent(100);
  };

  // Rail click handler
  const handleRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!railRef.current) return;
    const rect = railRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const percent = Math.min(100, Math.max(0, (clickY / rect.height) * 100));
    scrollToPercent(percent);
  };

  // Drag thumb handler
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!railRef.current) return;
      const rect = railRef.current.getBoundingClientRect();
      const moveY = moveEvent.clientY - rect.top;
      const percent = Math.min(100, Math.max(0, (moveY / rect.height) * 100));
      scrollToPercent(percent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch drag for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!railRef.current || !moveEvent.touches[0]) return;
      const rect = railRef.current.getBoundingClientRect();
      const touchY = moveEvent.touches[0].clientY - rect.top;
      const percent = Math.min(100, Math.max(0, (touchY / rect.height) * 100));
      scrollToPercent(percent);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };

  // If content fits completely or there are <= 1 items, do not render anything
  if (!isScrollable || totalItems <= 1) {
    return null;
  }

  const roundedPercent = Math.round(scrollProgress);
  const isAtBottom = roundedPercent >= 98;

  return (
    <div
      id="mistake-vault-scroll-bar"
      className={`fixed right-1 sm:right-2 top-28 bottom-24 z-30 flex flex-col items-center select-none pointer-events-auto transition-all duration-200 ${className}`}
    >
      {/* Scroll to Top Arrow */}
      <button
        onClick={handleScrollToTop}
        disabled={scrollProgress <= 3}
        className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-all mb-1 ${
          scrollProgress <= 3 ? 'opacity-0 pointer-events-none' : 'opacity-70 hover:opacity-100'
        }`}
        title="Scroll to top"
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
      </button>

      {/* Main Minimal Vertical Rail */}
      <div
        ref={railRef}
        onClick={handleRailClick}
        className="relative flex-1 w-3 sm:w-4 flex items-center justify-center cursor-pointer py-0.5 group"
      >
        {/* Track */}
        <div className="w-1 h-full bg-slate-800/70 group-hover:bg-slate-700/80 rounded-full shadow-inner overflow-hidden relative transition-all">
          {/* Active Fill Gradient */}
          <div
            className="w-full bg-gradient-to-b from-amber-500 via-rose-500 to-sky-400 rounded-full transition-all duration-75"
            style={{ height: `${scrollProgress}%` }}
          />
        </div>

        {/* Minimal Draggable Thumb Indicator */}
        <div
          onMouseDown={handleThumbMouseDown}
          onTouchStart={handleTouchStart}
          className="absolute left-1/2 -translate-x-1/2 w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-amber-400 border border-slate-950 shadow-sm cursor-grab active:cursor-grabbing hover:scale-110 active:scale-125 transition-transform flex items-center justify-center z-10"
          style={{ top: `calc(${scrollProgress}% - 6px)` }}
        />

        {/* Minimal Percentage Badge (Only during active drag/scroll) */}
        {(isDragging || isScrolling) && (
          <div
            className="absolute right-5 bg-slate-900/95 border border-amber-500/40 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shadow-lg pointer-events-none whitespace-nowrap animate-fadeIn z-20"
            style={{ top: `calc(${scrollProgress}% - 10px)` }}
          >
            {roundedPercent}%
          </div>
        )}
      </div>

      {/* Scroll to Bottom Arrow */}
      <button
        onClick={handleScrollToBottom}
        disabled={isAtBottom}
        className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-all mt-1 ${
          isAtBottom ? 'opacity-0 pointer-events-none' : 'opacity-70 hover:opacity-100'
        }`}
        title="Scroll to bottom"
        aria-label="Scroll to bottom"
      >
        <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
      </button>
    </div>
  );
};
