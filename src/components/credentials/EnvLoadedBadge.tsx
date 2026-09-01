import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface EnvLoadedBadgeProps {
  label?: string;
}

export const EnvLoadedBadge: React.FC<EnvLoadedBadgeProps> = ({
  label = 'Loaded from .env',
}) => (
  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
    <span>{label}</span>
  </span>
);
