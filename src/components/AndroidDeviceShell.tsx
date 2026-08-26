import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
}

export const AndroidDeviceShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div 
      id="vocabclash-root-shell"
      className="h-full h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col md:flex-row p-0 overflow-hidden fixed inset-0 select-none"
    >
      {/* Main Responsive App Container: Full-screen on Mobile, Ergonomic Wide Dashboard on Desktop/Laptop */}
      <div className="w-full h-full max-w-full lg:max-w-[1600px] flex-1 flex flex-col md:flex-row overflow-hidden relative bg-slate-950 md:bg-slate-900/60 shadow-2xl">
        {children}
      </div>
    </div>
  );
};
