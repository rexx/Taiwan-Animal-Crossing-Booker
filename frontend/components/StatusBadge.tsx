
import React from 'react';
import { Clock, CheckCircle2, Trash2 } from 'lucide-react';
import { ReplyStatus } from '../lib/api.ts';

interface StatusBadgeProps {
  status: ReplyStatus;
  big?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, big }) => {
  const config = {
    pending: { label: '處理中', icon: <Clock size={big ? 20 : 14} />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    active: { label: '已發布', icon: <CheckCircle2 size={big ? 20 : 14} />, color: 'bg-green-500/10 text-green-400 border-green-400/20' },
    deleted: { label: '已撤回', icon: <Trash2 size={big ? 20 : 14} />, color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  };

  const { label, icon, color } = config[status];

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold uppercase tracking-tight ${color} ${big ? 'text-base py-2 px-6' : 'text-[10px]'}`}>
      {icon}
      {label}
    </div>
  );
};
