import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

interface PoolHealthSummaryProps {
  onImportClick?: () => void;
  refreshTrigger?: number;
}

interface DifficultyStat {
  level: string;
  label: string;
  active: number;
  required: number;
  status: 'Sufficient' | 'Low' | 'Critical';
}

const TARGETS: Record<string, { label: string; required: number }> = {
  beginner: { label: 'Beginner', required: 30 },
  elementary: { label: 'Elementary', required: 30 },
  intermediate: { label: 'Intermediate', required: 30 },
  upper_intermediate: { label: 'Upper Intermediate', required: 60 },
};

export const PoolHealthSummary: React.FC<PoolHealthSummaryProps> = ({
  onImportClick,
  refreshTrigger = 0,
}) => {
  const [stats, setStats] = useState<DifficultyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalActive, setTotalActive] = useState(0);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dt_question_pool_stats')
        .select('*');

      if (error) throw error;

      const rawMap: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        if (row.difficulty_level) {
          rawMap[row.difficulty_level.toLowerCase()] = Number(row.active_count) || 0;
        }
      });

      let total = 0;
      const computed: DifficultyStat[] = Object.entries(TARGETS).map(([key, config]) => {
        const active = rawMap[key] || 0;
        total += active;
        const required = config.required;
        let status: 'Sufficient' | 'Low' | 'Critical' = 'Critical';

        if (active >= required) {
          status = 'Sufficient';
        } else if (active >= required * 0.5) {
          status = 'Low';
        } else {
          status = 'Critical';
        }

        return {
          level: key,
          label: config.label,
          active,
          required,
          status,
        };
      });

      setStats(computed);
      setTotalActive(total);
    } catch (err) {
      console.error('Error fetching question pool stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const criticalLevels = stats.filter((s) => s.status === 'Critical');

  const getStatusBadge = (status: 'Sufficient' | 'Low' | 'Critical') => {
    switch (status) {
      case 'Sufficient':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Sufficient
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Low
          </span>
        );
      case 'Critical':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Critical
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.06)] space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F4] pb-3">
        <div>
          <h3 className="text-sm font-bold text-[#1B3270] flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#2952A3]" />
            Question Pool Health
          </h3>
          <p className="text-xs text-[#4A5568] mt-0.5">
            Total active questions: <strong className="text-[#1B3270]">{totalActive}</strong> (150 needed for 10 non-repeating attempts per candidate)
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center space-x-1 text-xs text-[#2952A3] hover:text-[#1B3270] font-medium transition-colors"
          title="Refresh pool health"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* CRITICAL WARNING BANNER */}
      {criticalLevels.length > 0 && (
        <div className="p-3.5 rounded-[8px] bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">
                Question pool critically low in {criticalLevels.map((l) => l.label).join(', ')}.
              </p>
              <p className="text-rose-700 mt-0.5">
                Candidates will see repeated questions before completing round 1. Import questions immediately.
              </p>
            </div>
          </div>
          {onImportClick && (
            <button
              type="button"
              onClick={onImportClick}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs whitespace-nowrap transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              <span>Import Questions</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* 4 DIFFICULTY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const pct = Math.min(100, Math.round((stat.active / stat.required) * 100));
          return (
            <div
              key={stat.level}
              className="p-3.5 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFC] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1B3270]">
                  {stat.label}
                </span>
                {getStatusBadge(stat.status)}
              </div>

              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-bold text-[#1B3270]">
                  {stat.active}
                </span>
                <span className="text-xs text-[#94A3B8]">
                  / {stat.required} required
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#E2E8F4] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    stat.status === 'Sufficient'
                      ? 'bg-emerald-500'
                      : stat.status === 'Low'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PoolHealthSummary;
