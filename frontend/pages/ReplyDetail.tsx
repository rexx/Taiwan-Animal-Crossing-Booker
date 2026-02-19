
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ExternalLink, Info, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Reply, api } from '../lib/api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';

interface ReplyDetailProps {
  postId: string;
  adminKey: string;
  notify: any;
  onBack: any;
}

export const ReplyDetail: React.FC<ReplyDetailProps> = ({ postId, adminKey, notify, onBack }) => {
  const [reply, setReply] = useState<Reply | null>(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);

  const fetchDetail = async () => {
    try {
      const data = await api.getReply(postId);
      if (data.error) {
        notify('找不到該回覆', 'error');
        onBack();
      } else {
        setReply(data);
      }
    } catch (e) {
      notify('載入詳情失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [postId]);

  const handleReport = async () => {
    setReporting(true);
    try {
      const res = await api.reportReply(postId);
      if (res.success) {
        notify(res.auto_deleted ? '檢舉成功，該內容已被自動撤回' : '檢舉已送出');
        fetchDetail();
      }
    } catch (e) {
      notify('檢舉失敗', 'error');
    } finally {
      setReporting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('確定要從 Threads 撤回此回覆嗎？')) return;
    try {
      const res = await api.deleteReply(postId, adminKey);
      if (res.success) {
        notify('回覆已從 Threads 撤回');
        fetchDetail();
      }
    } catch (e) {
      notify('刪除失敗', 'error');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <Loader2 className="animate-spin text-white/10" size={48} />
    </div>
  );

  if (!reply) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="text-white/40 hover:text-white flex items-center gap-1 text-sm group">
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 返回列表
      </button>

      <div className="bg-[#121212] border border-white/10 rounded-3xl p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-black">回覆詳情</h2>
            <p className="text-white/40 text-xs font-mono">Post ID: {postId}</p>
          </div>
          <StatusBadge status={reply.status} big />
        </div>

        {reply.status === 'pending' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 flex gap-4">
            <Info className="text-blue-400 shrink-0" size={24} />
            <div className="space-y-1">
              <p className="font-bold text-blue-100">發布處理中...</p>
              <p className="text-sm text-blue-200/60 leading-relaxed">Meta 伺服器正在處理媒體容器。為了確保圖片上傳品質，我們會等待約 30 秒。請稍後重新整理本頁面。</p>
            </div>
          </div>
        )}

        <div className="grid gap-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/30">目標貼文連結</label>
            <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
              <span className="text-sm text-white/60 truncate mr-4">{reply.reply_to_url}</span>
              <a href={reply.reply_to_url} target="_blank" className="shrink-0 text-white/40 hover:text-white"><ExternalLink size={18} /></a>
            </div>
          </div>

          {reply.threads_url && reply.status === 'active' && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/30">機器人回覆連結</label>
              <a href={reply.threads_url} target="_blank" className="block w-full bg-white text-black text-center font-bold py-4 rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2">
                前往 Threads 查看 <ExternalLink size={18} />
              </a>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-white/5 flex flex-wrap gap-8 items-center justify-between">
          <div className="flex gap-10">
            <div className="space-y-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">檢舉進度</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${reply.report_count > 0 ? 'bg-red-500' : 'bg-white/10'}`} 
                    style={{width: `${(reply.report_count/reply.threshold)*100}%`}}
                  />
                </div>
                <span className="font-mono text-sm text-white/60">{reply.report_count} / {reply.threshold}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">觸發來源</span>
              <div className="flex items-center gap-1 text-sm text-white/60">
                {reply.trigger_source === 'manual' ? '網頁手動輸入' : 'Threads Mention'}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleReport}
              disabled={reporting || reply.status !== 'active'}
              className="px-6 py-3 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm font-bold flex items-center gap-2 disabled:opacity-20"
            >
              <AlertTriangle size={16} /> 檢舉回覆
            </button>
            
            {adminKey && reply.status !== 'deleted' && (
              <button 
                onClick={handleDelete}
                className="px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 text-sm font-bold rounded-xl transition-all hover:text-white flex items-center gap-2"
              >
                <Trash2 size={16} /> 管理員撤回
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
