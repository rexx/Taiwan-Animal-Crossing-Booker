
import React, { useState } from 'react';
import { ShieldCheck, History } from 'lucide-react';
import { auth } from './lib/auth.ts';
import { Home } from './pages/Home.tsx';
import { RepliesList } from './pages/RepliesList.tsx';
import { ReplyDetail } from './pages/ReplyDetail.tsx';
import { AdminPage, AdminLogin } from './pages/Admin.tsx';

export const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<'home' | 'list' | 'detail' | 'admin'>('home');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string>(auth.getAdminKey());
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAdminLogin = (key: string) => {
    auth.setAdminKey(key);
    setAdminKey(key);
    notify('管理員憑證已儲存');
  };

  const handleLogout = () => {
    auth.clearAdminKey();
    setAdminKey('');
    setCurrentRoute('home');
  };

  const navigate = (route: 'home' | 'list' | 'detail' | 'admin', id?: string) => {
    setCurrentRoute(route);
    if (id) setSelectedPostId(id);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-cream text-ink font-sans">
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-xl border transition-all animate-bounce ${
          notification.type === 'success' ? 'bg-olive text-white border-olive/20' : 'bg-red-700 text-white border-red-600'
        }`}>
          {notification.msg}
        </div>
      )}

      <nav className="border-b border-tan sticky top-0 bg-paper/80 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate('home')} className="flex items-center gap-2 group">
            <div className="bg-accent p-1.5 rounded-lg shadow-sm group-hover:bg-accent-dark transition-colors">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <span className="font-serif font-bold text-2xl tracking-tight text-ink">動森島脆友證書</span>
          </button>
          
          <div className="flex gap-6">
            <button onClick={() => navigate('list')} className="text-sm font-semibold text-ink/60 hover:text-accent flex items-center gap-1.5 transition-colors">
              <History size={16} /> 歷史紀錄
            </button>
            <button onClick={() => navigate('admin')} className="text-sm font-semibold text-ink/60 hover:text-accent flex items-center gap-1.5 transition-colors">
              <ShieldCheck size={16} /> 管理員
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {currentRoute === 'home' && <Home onSent={(id) => navigate('detail', id)} notify={notify} />}
        {currentRoute === 'list' && <RepliesList onSelect={(id) => navigate('detail', id)} />}
        {currentRoute === 'detail' && selectedPostId && (
          <ReplyDetail 
            postId={selectedPostId} 
            adminKey={adminKey} 
            notify={notify}
            onBack={() => navigate('list')}
          />
        )}
        {currentRoute === 'admin' && (
          adminKey ? (
            <AdminPage adminKey={adminKey} onLogout={handleLogout} onSelect={(id: string) => navigate('detail', id)} notify={notify} />
          ) : (
            <AdminLogin onLogin={handleAdminLogin} />
          )
        )}
      </div>
    </div>
  );
};
