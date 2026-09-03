import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface JsonCopyBlockProps {
  label: string;
  labelClassName?: string;
  data: unknown;
  className?: string;
}

export const JsonCopyBlock: React.FC<JsonCopyBlockProps> = ({
  label,
  labelClassName = 'text-slate-700',
  data,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className={`bg-slate-50 p-2.5 rounded-lg border border-slate-200 overflow-hidden font-mono text-[10px] flex flex-col min-h-0 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1 shrink-0">
        <span className={`font-bold ${labelClassName}`}>{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy JSON'}
          aria-label={copied ? 'Copied to clipboard' : `Copy ${label}`}
          className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors cursor-pointer shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="text-slate-700 flex-1 overflow-auto">{text}</pre>
    </div>
  );
};
