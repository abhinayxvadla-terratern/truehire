import React from 'react';
import { Inbox, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  subtitle,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`py-12 px-6 text-center flex flex-col items-center justify-center ${className}`}
    >
      <Icon className="w-10 h-10 stroke-[#CBD5E9] stroke-[1.5] mb-3" />
      <h4 className="text-[14px] font-medium text-[#1B3270] mb-1 leading-tight">
        {title}
      </h4>
      <span className="text-[12px] text-[#94A3B8] leading-tight">
        {subtitle}
      </span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 btn-primary"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
