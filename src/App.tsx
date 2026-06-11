import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useView } from './app/hooks';
import { startNewsAutoRefresh } from './app/controls';
import { st } from './store/engine';
import { SettingsPanel } from './components/SettingsPanel';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const view = useView();

  useEffect(() => {
    const stopNews = startNewsAutoRefresh();
    // Warn before refresh/close while connected (ported from boot.js).
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (st.connected) {
        e.preventDefault();
        e.returnValue =
          'Тизим уланган. Чиқаётганингизга ишончингиз комилми? (Ҳолат сақланади — қайта улаш орқали тикланади)';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      stopNews();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  return (
    <div className="min-h-screen w-full px-[18px] py-3.5 max-md:p-2.5">
      <Toaster theme="dark" richColors closeButton position="top-right" />
      {view === 'dashboard' ? <Dashboard /> : <SettingsPanel />}
    </div>
  );
}
