import React, { useState, useEffect } from 'react';
import { ChevronLeft, ExternalLink, Info, AlertTriangle, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
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
  const CERTIFICATE_IMAGE = 'https://rexx.github.io/public/certificate.jpg';

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
      <button onClick={onBack} className="text-ink/40 hover:text-accent flex items-center gap-1.5 text-sm font-bold group transition-colors">
        <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> 返回列表
      </button>

      <div className="bg-white border-4 border-tan rounded-[3rem] p-10 space-y-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-tan pb-6">
          <div className="space-y-2">
            <h2 className="text-4xl font-serif font-bold text-ink">回覆詳情</h2>
            <p className="text-ink/40 text-xs font-mono font-bold tracking-wider">Post ID: {postId}</p>
          </div>
          <StatusBadge status={reply.status} big />
        </div>

        {reply.status === 'pending' && (
          <div className="bg-paper border-2 border-tan rounded-3xl p-8 flex gap-6 shadow-inner">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center shrink-0">
              <Info className="text-accent" size={28} />
            </div>
            <div className="space-y-2">
              <p className="font-serif font-bold text-xl text-ink">發布處理中...</p>
              <p className="text-base text-ink/60 leading-relaxed font-medium">Meta 伺服器正在處理媒體容器。為了確保圖片上傳品質，我們會等待約 30 秒。請稍後重新整理本頁面。</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-xs uppercase font-bold tracking-[0.2em] text-ink/30">目標貼文連結</label>
              <div className="bg-paper p-5 rounded-2xl border-2 border-tan flex items-center justify-between shadow-sm">
                <span className="text-sm text-ink/60 truncate mr-4 font-medium">{reply.reply_to_url}</span>
                <a href={reply.reply_to_url} target="_blank" className="shrink-0 w-10 h-10 bg-white border border-tan rounded-full flex items-center justify-center text-ink/40 hover:text-accent hover:border-accent transition-all"><ExternalLink size={18} /></a>
              </div>
            </div>

            {reply.threads_url && reply.status === 'active' && (
              <div className="space-y-3">
                <label className="text-xs uppercase font-bold tracking-[0.2em] text-ink/30">Booker 回覆連結</label>
                <a href={reply.threads_url} target="_blank" className="block w-full bg-accent text-white text-center font-bold py-5 rounded-2xl hover:bg-accent-dark hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-3 text-lg shadow-md">
                  前往 Threads 查看 <ExternalLink size={20} />
                </a>
              </div>
            )}

            <div className="pt-6 space-y-6">
               <div className="space-y-3">
                <span className="text-xs text-ink/30 uppercase tracking-[0.2em] font-bold">檢舉進度</span>
                <div className="flex items-center gap-4">
                  <div className="h-3 w-full bg-tan/30 rounded-full overflow-hidden border border-tan/20">
                    <div 
                      className={`h-full transition-all duration-1000 ${reply.report_count > 0 ? 'bg-accent' : 'bg-tan/20'}`} 
                      style={{width: `${(reply.report_count/reply.threshold)*100}%`}}
                    />
                  </div>
                  <span className="font-serif font-bold text-lg text-ink/60 whitespace-nowrap">{reply.report_count} / {reply.threshold}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-4 border-b border-tan/40">
                <span className="text-xs text-ink/30 uppercase tracking-[0.2em] font-bold">觸發來源</span>
                <span className="text-base text-ink/60 font-bold">
                  {reply.trigger_source === 'manual' ? '網頁手動輸入' : 'Threads Mention'}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-4 border-b border-tan/40">
                <span className="text-xs text-ink/30 uppercase tracking-[0.2em] font-bold">建立時間</span>
                <span className="text-base text-ink/60 font-bold">
                  {new Date(reply.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs uppercase font-bold tracking-[0.2em] text-ink/30 flex items-center gap-2">
              <ImageIcon size={16} /> 已發送證書
            </label>
            <div className="bg-paper border-4 border-tan rounded-[2rem] overflow-hidden aspect-square flex items-center justify-center p-4 shadow-inner">
              <div className="certificate-border w-full h-full rounded-xl overflow-hidden flex items-center justify-center bg-white">
                <img 
                  src={CERTIFICATE_IMAGE} 
                  alt="Sent Certificate" 
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-tan/40 flex flex-wrap gap-4 items-center justify-end">
          <button 
            onClick={handleReport}
            disabled={reporting || reply.status !== 'active'}
            className="px-8 py-4 border-2 border-accent/20 text-accent hover:bg-accent/5 rounded-2xl transition-all text-base font-bold flex items-center gap-2 disabled:opacity-20"
          >
            <AlertTriangle size={20} /> 檢舉回覆
          </button>
          
          {adminKey && reply.status !== 'deleted' && (
            <button 
              onClick={handleDelete}
              className="px-8 py-4 bg-red-50 text-white hover:bg-red-700 text-base font-bold rounded-2xl transition-all shadow-md flex items-center gap-2"
            >
              <Trash2 size={20} /> 管理員撤回
            </button>
          )}
        </div>
      </div>
    </div>
  );
};