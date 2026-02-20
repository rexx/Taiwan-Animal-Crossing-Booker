
import React from 'react';
import { Clock, CheckCircle2, Trash2 } from 'lucide-react';
import { ReplyStatus } from '../lib/api.ts';

interface StatusBadgeProps {
  status: ReplyStatus;
  big?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, big }) => {
  const config = {
    pending: { label: '處理中', icon: <Clock size={big ? 20 : 14} />, color: 'bg-paper text-accent border-tan' },
    active: { label: '已發布', icon: <CheckCircle2 size={big ? 20 : 14} />, color: 'bg-olive text-white border-olive/20' },
    deleted: { label: '已撤回', icon: <Trash2 size={big ? 20 : 14} />, color: 'bg-red-50 text-red-600 border-red-200' },
  };

  const { label, icon, color } = config[status];

  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border-2 font-bold uppercase tracking-widest shadow-sm ${color} ${big ? 'text-lg py-3 px-8' : 'text-[10px]'}`}>
      {icon}
      {label}
    </div>
  );
};
