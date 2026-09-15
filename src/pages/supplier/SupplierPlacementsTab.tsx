import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Award } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/formatters';

interface SupplierPlacementsTabProps {
  supplier: any;
}

interface PlacementItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_role: string;
  job_title: string;
  job_location: string;
  placed_date: string;
  employer: string;
}

export const SupplierPlacementsTab: React.FC<SupplierPlacementsTabProps> = ({ supplier }) => {
  const [placements, setPlacements] = useState<PlacementItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlacements = async () => {
    if (!supplier?.id) return;
    try {
      setLoading(true);

      // Pull job_applications where supplier_id = current supplier AND status = 'placed'
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          status,
          updated_at,
          created_at,
          candidates (
            id,
            first_name,
            last_name,
            target_role
          ),
          job_requirements (
            id,
            title,
            location
          )
        `)
        .eq('supplier_id', supplier.id)
        .eq('status', 'placed')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading supplier placements:', error);
        setPlacements([]);
        return;
      }

      const formatted: PlacementItem[] = (data || []).map((item: any) => {
        const cand = item.candidates;
        const candName = cand
          ? `${cand.first_name || ''} ${cand.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        return {
          id: item.id,
          candidate_id: item.candidate_id,
          candidate_name: candName,
          candidate_role: cand?.target_role || 'Healthcare',
          job_title: item.job_requirements?.title || 'German Healthcare Provider',
          job_location: item.job_requirements?.location || 'Germany',
          placed_date: item.updated_at || item.created_at,
          employer: 'Anonymized',
        };
      });

      setPlacements(formatted);
    } catch (err) {
      console.error('Unexpected error fetching placements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacements();
  }, [supplier?.id]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150 pb-12">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-[#1B3270]">
          Candidate Placements
        </h3>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          Record of candidates successfully placed with accredited German hospital networks and care groups.
        </p>
      </div>

      {/* SUMMARY CARD AT TOP */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-xs flex items-center justify-between max-w-sm">
        <div>
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
            Total Placements
          </span>
          <span className="text-3xl font-extrabold text-[#10B981] mt-1 block">
            {placements.length}
          </span>
          <span className="text-[11px] text-[#4A5568] mt-1 block">
            TVöD contract & visa verified
          </span>
        </div>
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#10B981]">
          <Award className="w-6 h-6" />
        </div>
      </div>

      {/* PLACEMENTS TABLE */}
      {placements.length === 0 ? (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs">
          <EmptyState
            title="No placements yet"
            subtitle="Placements will appear here once a candidate completes the full process and is successfully placed."
            icon={Award}
          />
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F4] bg-[#F8FAFD] text-[#94A3B8]">
                  <th className="py-3 px-4 font-semibold">Candidate Name</th>
                  <th className="py-3 px-3 font-semibold">Role</th>
                  <th className="py-3 px-3 font-semibold">Job Title</th>
                  <th className="py-3 px-3 font-semibold">Location</th>
                  <th className="py-3 px-3 font-semibold">Placed Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Employer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                {placements.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Candidate Name */}
                    <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                      {item.candidate_name}
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1B3270]/10 text-[#1B3270] capitalize">
                        {item.candidate_role}
                      </span>
                    </td>

                    {/* Job Title */}
                    <td className="py-3.5 px-3 font-medium text-[#1B3270]">
                      {item.job_title}
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-3 text-[#4A5568]">
                      {item.job_location}
                    </td>

                    {/* Placed Date */}
                    <td className="py-3.5 px-3 text-[#4A5568] font-mono text-[11px]">
                      {formatDate(item.placed_date)}
                    </td>

                    {/* Employer (All tiers -> Anonymized) */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-[#94A3B8] border border-gray-200">
                        {item.employer}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
