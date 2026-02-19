
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black">管理中心</h2>
        <div className="flex items-center gap-4">
           <button onClick={fetchAdminReplies} className="p-2 text-white/40 hover:text-white transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onLogout} className="text-white/40 hover:text-red-400 flex items-center gap-1 text-sm font-bold">
            <LogOut size={16}/> 登出系統
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <input 
            type="text" 
            placeholder="搜尋 URL 或 ID..." 
            className="w-full bg-[#121212] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <select 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/60 focus:outline-none"
        >
          <option value="all">所有狀態</option>
          <option value="active">已發布</option>
          <option value="pending">處理中</option>
          <option value="deleted">已撤回</option>
        </select>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
             <Loader2 className="animate-spin text-white/10" size={40} />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-white/5 text-white/40 font-bold uppercase tracking-widest text-[10px] border-b border-white/10">
                <th className="px-6 py-4">狀態</th>
                <th className="px-6 py-4">來源</th>
                <th className="px-6 py-4">目標網址</th>
                <th className="px-6 py-4 text-center">檢舉數</th>
                <th className="px-6 py-4 text-right">管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {replies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-white/20 italic">找不到符合條件的資料</td>
                </tr>
              ) : (
                replies.map(r => (
                  <tr key={r.post_id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        r.trigger_source === 'manual' ? 'border-white/10 text-white/40' : 'border-purple-500/20 text-purple-400'
                      }`}>
                        {r.trigger_source === 'manual' ? 'WEB' : 'TAG'}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[240px] truncate text-white/60 font-mono text-xs">{r.reply_to_url}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-mono ${r.report_count >= r.threshold ? 'text-red-500 font-bold' : 'text-white/40'}`}>
                        {r.report_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => r.post_id && onSelect(r.post_id)} 
                        className="bg-white/5 hover:bg-white text-white/60 hover:text-black px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      >
                        檢視詳情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
    <div className="max-w-md mx-auto py-20 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-black">管理員驗證</h2>
        <p className="text-white/40 text-sm">請輸入後端配置的 ADMIN_API_KEY 以解鎖功能</p>
      </div>
      <div className="space-y-4">
        <input 
          type="password" 
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="輸入 API 密鑰..."
          className="w-full bg-[#121212] border border-white/10 rounded-2xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-center tracking-[0.5em]"
        />
        <button 
          onClick={() => onLogin(key)}
          disabled={!key}
          className="w-full bg-white text-black font-bold py-5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          登入系統
        </button>
      </div>
    </div>
  );
};
