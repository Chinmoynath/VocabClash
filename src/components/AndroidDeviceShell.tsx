import React, { useState } from 'react';
import { Smartphone, Maximize2 } from 'lucide-react';
import { VocabClashLogo } from './VocabClashLogo';

interface AndroidDeviceShellProps {
  children: React.ReactNode;
}

export const AndroidDeviceShell: React.FC<AndroidDeviceShellProps> = ({ children }) => {
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);

  return (
    <div className="h-[100dvh] w-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-0 md:p-3 select-none overflow-hidden fixed inset-0">
      {/* Top Desktop Controls & Mode Toggle */}
      <aside aria-label="Device Controls" className="hidden md:flex items-center justify-between w-full max-w-md mb-2 px-2 text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <VocabClashLogo size="sm" className="rounded-lg shadow-sm" />
          <span className="font-bold text-slate-200 tracking-tight">VocabClash</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <button
          onClick={() => setIsPhoneFrame(!isPhoneFrame)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
          title="Toggle Mobile Shell / Full Width"
        >
          {isPhoneFrame ? (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Screen</span>
            </>
          ) : (
            <>
              <Smartphone className="w-3.5 h-3.5" />
              <span>Phone Frame</span>
            </>
          )}
        </button>
      </aside>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-300 relative flex flex-col min-h-0 ${
          isPhoneFrame
            ? 'max-w-[430px] h-[100dvh] md:h-[860px] md:max-h-[92vh] md:rounded-[44px] md:border-[10px] md:border-slate-800 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(16,185,129,0.15)] overflow-hidden bg-slate-900'
            : 'max-w-2xl md:max-w-3xl h-[100dvh] md:h-[90vh] md:max-h-[92vh] md:rounded-3xl md:border md:border-slate-800 md:shadow-2xl overflow-hidden bg-slate-900'
        }`}
      >
        {/* Dynamic App Content Body */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
};
