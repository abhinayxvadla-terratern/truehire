import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
  children?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', children }) => {
  const norm = (status || '').trim().toLowerCase();

  let styles = 'bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]';

  // "Active" / "Pass" / "Verified" / "Placed" / "Approved" / "Interview Ready"
  if (
    norm === 'active' ||
    norm === 'pass' ||
    norm === 'verified' ||
    norm === 'placed' ||
    norm === 'approved' ||
    norm === 'interview ready' ||
    norm === 'interview_ready'
  ) {
    styles = 'bg-[#F0FDF4] text-[#166534]';
  }
  // "Pending" / "In Progress" / "Scheduled" / "Under Review" / "Proposed"
  else if (
    norm === 'pending' ||
    norm === 'in progress' ||
    norm === 'in_progress' ||
    norm === 'scheduled' ||
    norm === 'under review' ||
    norm === 'under_review' ||
    norm === 'proposed'
  ) {
    styles = 'bg-[#FFFBEB] text-[#92400E]';
  }
  // "Applied" / "Shortlisted" / "Basic"
  else if (norm === 'applied' || norm === 'shortlisted' || norm === 'basic') {
    styles = 'bg-[#EFF6FF] text-[#1e40af]';
  }
  // "Failed" / "Rejected" / "Locked" / "Not Progressed" / "Cancelled"
  else if (
    norm === 'fail' ||
    norm === 'failed' ||
    norm === 'rejected' ||
    norm === 'locked' ||
    norm === 'not progressed' ||
    norm === 'not_progressed' ||
    norm === 'cancelled'
  ) {
    styles = 'bg-[#FEF2F2] text-[#991b1b]';
  }
  // "Invite Pending" / "Stalled" / "Cooling"
  else if (
    norm === 'invite pending' ||
    norm === 'invite_pending' ||
    norm === 'stalled' ||
    norm === 'cooling'
  ) {
    styles = 'bg-[#F5F3FF] text-[#5b21b6]';
  }
  // "Audited" / "Interview Scheduled"
  else if (
    norm === 'audited' ||
    norm === 'interview scheduled' ||
    norm === 'interview_scheduled'
  ) {
    styles = 'bg-[#F0F4FF] text-[#1B3270]';
  }
  // "Inactive" / "Deactivated" / "Closed"
  else if (norm === 'inactive' || norm === 'deactivated' || norm === 'closed') {
    styles = 'bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]';
  }

  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-[4px] whitespace-nowrap ${styles} ${className}`}
    >
      {children || status}
    </span>
  );
};

export default StatusBadge;
