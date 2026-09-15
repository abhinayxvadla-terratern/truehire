import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface MultiSelectOption {
  label: string;
  value: string;
}

export interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  className?: string;
  minWidth?: string;
  align?: 'left' | 'right';
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  className = '',
  minWidth = '180px',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Label calculation logic
  const triggerLabel = (() => {
    if (selectedValues.length === 0) {
      return `All ${label}`;
    }
    if (selectedValues.length === 1) {
      const match = options.find((opt) => opt.value === selectedValues[0]);
      return match ? match.label : selectedValues[0];
    }
    return `${selectedValues.length} Selected`;
  })();

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(options.map((opt) => opt.value));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-[36px] w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[8px] text-xs bg-white text-slate-700 flex items-center justify-between gap-2 shadow-2xs hover:border-[#1B3270]/40 transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-[#1B3270]"
        style={{ minWidth }}
      >
        <span className="truncate font-medium">{triggerLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#1B3270]' : ''
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute mt-1.5 bg-white border border-[#E2E8F4] rounded-[8px] shadow-lg z-[200] overflow-hidden ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ minWidth: minWidth || '180px', width: 'max-content', maxWidth: '320px' }}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 bg-white border-b border-[#E2E8F4] px-3 py-1.5 flex items-center justify-between z-10">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[11px] font-semibold text-[#1B3270] hover:underline cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* Options List */}
          <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-100">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <div
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  className="h-[36px] px-3 flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                >
                  {/* Custom Checkbox (16px x 16px) */}
                  <div
                    className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#1B3270] text-white border-none'
                        : 'border border-[#CBD5E1] bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-[13px] truncate ${
                      isSelected ? 'text-[#1B3270] font-medium' : 'text-slate-600'
                    }`}
                  >
                    {option.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;
