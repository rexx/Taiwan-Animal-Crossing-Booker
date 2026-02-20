
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
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-tan pb-4">
        <h2 className="text-3xl font-serif font-bold text-ink">所有回覆</h2>
        <span className="text-xs text-ink/40 uppercase tracking-widest font-bold">只顯示已發布</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="animate-spin text-accent" size={48} />
          <p className="text-ink/40 text-sm font-bold uppercase tracking-widest">載入中</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {replies.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-tan rounded-[2rem] text-ink/20 font-medium text-lg">
              暫無回覆記錄
            </div>
          ) : (
            replies.map(r => (
              <button
                key={r.post_id || Math.random()}
                onClick={() => r.post_id && onSelect(r.post_id)}
                className="bg-white border-2 border-tan p-8 rounded-[2rem] text-left hover:border-accent hover:shadow-xl transition-all flex items-center justify-between group shadow-sm"
              >
                <div className="space-y-3 max-w-[85%]">
                  <div className="flex items-center gap-4">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-ink/40 font-semibold">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-ink/60 text-base truncate font-medium">{r.reply_to_url}</p>
                </div>
                <div className="w-12 h-12 rounded-full border-2 border-tan flex items-center justify-center group-hover:border-accent group-hover:bg-accent transition-all">
                  <ChevronRight className="text-tan group-hover:text-white transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
