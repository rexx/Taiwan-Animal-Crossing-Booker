
import React, { useState, useEffect } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Reply, api } from '../lib/api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';

interface RepliesListProps {
  onSelect: (id: string) => void;
}

export const RepliesList: React.FC<RepliesListProps> = ({ onSelect }) => {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReplies = async () => {
      setLoading(true);
      try {
        const data = await api.getReplies();
        setReplies(data.replies || []);
      } catch (e) {
        console.error("API Error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchReplies();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">所有回覆</h2>
        <span className="text-xs text-white/40 uppercase tracking-widest">只顯示已發布</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-white/20" size={40} />
          <p className="text-white/20 text-sm font-bold uppercase tracking-widest">載入中</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {replies.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl text-white/20">
              暫無回覆記錄
            </div>
          ) : (
            replies.map(r => (
              <button
                key={r.post_id || Math.random()}
                onClick={() => r.post_id && onSelect(r.post_id)}
                className="bg-[#121212] border border-white/10 p-6 rounded-2xl text-left hover:border-white/20 transition-all flex items-center justify-between group"
              >
                <div className="space-y-2 max-w-[80%]">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status} />
                    <span className="text-[10px] text-white/40 font-mono">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-white/60 text-sm truncate">{r.reply_to_url}</p>
                </div>
                <ChevronRight className="text-white/20 group-hover:text-white transition-colors" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
