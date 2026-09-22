import React from 'react';
import { StartupSplashOverlay } from './StartupSplashOverlay';

interface AppShellProps {
  children: React.ReactNode;
  isStartupReady?: boolean;
}

export const AndroidDeviceShell: React.FC<AppShellProps> = ({ children, isStartupReady }) => {
  return (
    <div 
      id="vocabclash-root-shell"
      className="h-full h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col md:flex-row p-0 overflow-hidden fixed inset-0 select-none"
    >
      <StartupSplashOverlay isReady={isStartupReady} />
      {/* Main Responsive App Container: Full-screen on Mobile, Ergonomic Wide Dashboard on Desktop/Laptop */}
      <div className="w-full h-full max-w-full lg:max-w-[1600px] flex-1 flex flex-col md:flex-row overflow-hidden relative bg-slate-950 md:bg-slate-900/60 shadow-2xl">
        {children}
      </div>
    </div>
  );
};
