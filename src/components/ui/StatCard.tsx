import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  loading = false,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(27,50,112,0.06)] min-w-0 flex-1 flex flex-col justify-center gap-1.5 transition-colors ${
        onClick ? 'cursor-pointer hover:border-[#CBD5E9] hover:bg-[#F0F4FF]/30' : ''
      } ${className}`}
    >
      {loading ? (
        <div className="h-7 w-16 skeleton my-0.5" />
      ) : (
        <span className="text-[24px] leading-tight font-semibold text-[#1B3270]">
          {value}
        </span>
      )}
      <span className="text-[12px] font-normal text-[#94A3B8] truncate">
        {label}
      </span>
    </div>
  );
};

export const StatRow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-6 ${className}`}
    >
      {children}
    </div>
  );
};

export default StatCard;
