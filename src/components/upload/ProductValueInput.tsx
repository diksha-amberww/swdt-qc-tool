import React from 'react';
import { ValidatorService } from '../../services/validatorService';

interface ProductValueInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

/** Fixed header row + editable values area (header cannot be edited). */
export const ProductValueInput: React.FC<ProductValueInputProps> = ({
  value,
  onChange,
  placeholder = 'B0000AXN5U\t686226806970\tPRM80697',
  rows,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(ValidatorService.stripHeaderFromPaste(e.target.value));
  };

  return (
    <div className={`flex flex-col min-h-0 border border-slate-300 rounded-lg overflow-hidden bg-white ${className}`}>
      <div
        className="grid grid-cols-3 gap-3 px-3 py-2.5 bg-slate-100 border-b border-slate-300 font-mono text-[11px] font-bold text-slate-700 uppercase tracking-wide select-none shrink-0"
        aria-hidden="true"
      >
        <span>ASIN</span>
        <span>UPC</span>
        <span>Vendor Model</span>
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="flex-1 w-full p-3 font-mono text-xs text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/30 resize-none overflow-auto leading-relaxed min-h-[120px]"
        spellCheck={false}
      />
    </div>
  );
};
