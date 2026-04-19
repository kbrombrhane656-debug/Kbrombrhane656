import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, BarChart2, Package, Users, AlertCircle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAppStore } from '../data/store';
import { useTranslation } from '../i18n';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export const Layout = () => {
  const location = useLocation();
  const { language, globalError, setGlobalError } = useAppStore();
  const t = useTranslation(language);

  const navItems = [
    { path: '/', icon: Home, label: t('home') },
    { path: '/inventory', icon: Package, label: t('inventory') },
    { path: '/add', icon: PlusCircle, label: t('add'), special: true },
    { path: '/people', icon: Users, label: t('peopleDebts') },
    { path: '/reports', icon: BarChart2, label: t('reports') },
  ];

  let parsedError = null;
  if (globalError) {
    try { parsedError = JSON.parse(globalError); } catch(e) {}
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-bg font-sans text-primary">
      {globalError && (
        <div className="absolute top-4 left-4 right-4 z-[100] bg-[#FEF3F2] border border-[#FECDCA] shadow-lg rounded-2xl p-4 animate-in slide-in-from-top-4">
           <div className="flex gap-3">
             <AlertCircle className="text-[#B42318] shrink-0" size={20} />
             <div className="flex-1">
               <h4 className="text-[#B42318] font-bold text-[14px]">Permission Denied or Sync Error</h4>
               <p className="text-[#B42318]/80 text-[12px] mt-1">
                 {parsedError ? `Action "${parsedError.operationType}" failed. You might not have the correct permissions, or you're operating as a staff member without access to this action.` : globalError}
               </p>
             </div>
             <button onClick={() => setGlobalError(null)} className="text-[#B42318]/60 hover:text-[#B42318] p-1"><X size={16} /></button>
           </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
      
      <nav className="fixed bottom-0 w-full bg-card border-t border-border px-4 py-2 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          if (item.special) {
            return (
              <Link key={item.path} to={item.path} className="relative -top-6">
                <div className="bg-accent text-white p-4 rounded-full shadow-[0_8px_16px_rgba(46,125,50,0.3)] hover:opacity-90 transition-opacity flex items-center justify-center w-14 h-14">
                  <Icon size={24} />
                </div>
              </Link>
            );
          }

          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className={cn(
                "flex flex-col items-center p-2 text-[10px] font-medium transition-colors",
                isActive ? "text-accent" : "text-secondary hover:text-primary"
              )}
            >
              <Icon size={22} className="mb-1" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
