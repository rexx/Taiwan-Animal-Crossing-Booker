
import React, { useState, useEffect } from 'react';
import { LogOut, Search, Filter, Loader2, RefreshCw } from 'lucide-react';
import { Reply, api } from '../lib/api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';

interface AdminPageProps {
  adminKey: string;
  onLogout: any;
  onSelect: any;
  notify: any;
}

export const AdminPage: React.FC<AdminPageProps> = ({ adminKey, onLogout, onSelect, notify }) => {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchAdminReplies = async () => {
    setLoading(true);
    try {
      const data = await api.adminGetReplies(adminKey, { status: filter });
      setReplies(data.replies || []);
    } catch (e) {
      notify('載入管理列表失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminReplies();
  }, [filter]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-tan pb-6">
        <h2 className="text-4xl font-serif font-bold text-ink">管理中心</h2>
        <div className="flex items-center gap-6">
           <button onClick={fetchAdminReplies} className="p-3 text-ink/40 hover:text-accent transition-colors bg-white border border-tan rounded-full shadow-sm">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onLogout} className="text-ink/40 hover:text-red-500 flex items-center gap-2 text-sm font-bold transition-colors">
            <LogOut size={18}/> 登出系統
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-ink/20" size={20} />
          <input 
            type="text" 
            placeholder="搜尋 URL 或 ID..." 
            className="w-full bg-white border-2 border-tan rounded-2xl pl-14 pr-6 py-4 text-base focus:outline-none focus:border-accent shadow-sm"
          />
        </div>
        <select 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white border-2 border-tan rounded-2xl px-6 py-4 text-base text-ink/60 font-bold focus:outline-none focus:border-accent shadow-sm cursor-pointer"
        >
          <option value="all">所有狀態</option>
          <option value="active">已發布</option>
          <option value="pending">處理中</option>
          <option value="deleted">已撤回</option>
        </select>
      </div>

      <div className="bg-white border-4 border-tan rounded-[2.5rem] overflow-hidden min-h-[400px] shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-4">
             <Loader2 className="animate-spin text-accent" size={48} />
             <p className="text-ink/40 font-bold tracking-widest uppercase text-xs">載入中</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-paper text-ink/40 font-bold uppercase tracking-[0.2em] text-[11px] border-b border-tan">
                  <th className="px-8 py-5">狀態</th>
                  <th className="px-8 py-5">來源</th>
                  <th className="px-8 py-5">目標網址</th>
                  <th className="px-8 py-5 text-center">檢舉數</th>
                  <th className="px-8 py-5 text-right">管理</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/40">
                {replies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-24 text-center text-ink/20 italic font-medium text-lg">找不到符合條件的資料</td>
                  </tr>
                ) : (
                  replies.map(r => (
                    <tr key={r.post_id} className="hover:bg-cream/30 transition-colors group">
                      <td className="px-8 py-6"><StatusBadge status={r.status} /></td>
                      <td className="px-8 py-6">
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border-2 ${
                          r.trigger_source === 'manual' ? 'border-tan text-ink/40' : 'border-accent/20 text-accent'
                        }`}>
                          {r.trigger_source === 'manual' ? 'WEB' : 'TAG'}
                        </span>
                      </td>
                      <td className="px-8 py-6 max-w-[240px] truncate text-ink/60 font-bold">{r.reply_to_url}</td>
                      <td className="px-8 py-6 text-center">
                        <span className={`font-serif font-bold text-lg ${r.report_count >= r.threshold ? 'text-red-500' : 'text-ink/40'}`}>
                          {r.report_count}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => r.post_id && onSelect(r.post_id)} 
                          className="bg-paper hover:bg-accent text-ink/60 hover:text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          檢視詳情
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

interface AdminLoginProps {
  onLogin: (key: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [key, setKey] = useState('');
  return (
    <div className="max-w-md mx-auto py-24 text-center space-y-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="space-y-4">
        <h2 className="text-4xl font-serif font-bold text-ink">管理員驗證</h2>
        <p className="text-ink/40 text-base font-medium">請輸入後端配置的 ADMIN_API_KEY 以解鎖功能</p>
      </div>
      <div className="space-y-6">
        <input 
          type="password" 
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="輸入 API 密鑰..."
          className="w-full bg-white border-2 border-tan rounded-3xl px-8 py-6 focus:outline-none focus:border-accent transition-all text-center tracking-[0.5em] text-xl shadow-sm"
        />
        <button 
          onClick={() => onLogin(key)}
          disabled={!key}
          className="w-full bg-accent text-white font-bold py-6 rounded-3xl hover:bg-accent-dark hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 text-xl shadow-md"
        >
          登入系統
        </button>
      </div>
    </div>
  );
};
