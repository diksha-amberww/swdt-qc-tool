import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const ENV_MASK_DISPLAY = '••••••••';

interface MaskedEnvInputProps {
  value: string;
  maskedFromEnv: boolean;
  onChange: (value: string) => void;
  onClearMask?: () => void;
  type?: 'text' | 'password';
  placeholder?: string;
  className?: string;
  mono?: boolean;
  showToggle?: boolean;
}

export const MaskedEnvInput: React.FC<MaskedEnvInputProps> = ({
  value,
  maskedFromEnv,
  onChange,
  onClearMask,
  type = 'text',
  placeholder,
  className = '',
  mono = false,
  showToggle = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const showMasked = maskedFromEnv && !editing && !value;

  const handleFocus = () => {
    if (showMasked) {
      onClearMask?.();
      setEditing(true);
    }
  };

  const handleChange = (next: string) => {
    if (next === ENV_MASK_DISPLAY) return;
    setEditing(true);
    onChange(next);
  };

  const handleBlur = () => {
    if (!value) setEditing(false);
  };

  const inputType = showMasked ? 'password' : showToggle && !revealed ? 'password' : type;
  const inputClass = `${showToggle && !showMasked ? 'pl-3 pr-9' : 'px-3'} py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 ${className}`;

  return (
    <div className="relative">
      <input
        type={inputType}
        value={showMasked ? ENV_MASK_DISPLAY : value}
        readOnly={showMasked}
        onFocus={handleFocus}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={showMasked ? undefined : placeholder}
        className={`w-full ${inputClass} ${showMasked ? 'text-slate-500 tracking-widest' : ''} ${mono ? 'font-mono' : ''}`}
      />
      {showToggle && !showMasked && (
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
        >
          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
};
