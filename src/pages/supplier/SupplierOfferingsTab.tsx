import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, ShieldCheck, GraduationCap } from 'lucide-react';
import { getGateLabel, getOfferingTypeLabel } from '../../utils/labels';

interface SupplierOfferingsTabProps {
  supplier: any;
}

export const SupplierOfferingsTab: React.FC<SupplierOfferingsTabProps> = ({
  supplier,
}) => {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOfferings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('offerings')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching offerings:', error);
      } else {
        setOfferings(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching offerings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferings();
  }, []);

  const currentTier = supplier?.tier || 'basic';

  const getTierBadge = () => {
    switch (currentTier) {
      case 'audited':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 capitalize">
            Audited Partner
          </span>
        );
      case 'verified':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#2952A3]/10 text-[#2952A3] border border-[#2952A3]/20 capitalize">
            Verified Partner
          </span>
        );
      case 'basic':
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-[#94A3B8] border border-gray-200 capitalize">
            Basic Partner
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Subscription Info Card at Top */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F4]">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck size={20} className="text-[#2952A3]" />
            <h3 className="text-base font-bold text-[#1B3270]">
              Partner Subscription & Tier Overview
            </h3>
          </div>
          <div>{getTierBadge()}</div>
        </div>

        <div className="space-y-1 text-xs text-[#4A5568] leading-relaxed">
          <p>
            Your current tier:{' '}
            <strong className="text-[#1B3270] capitalize">{currentTier}</strong>.
          </p>
          <p>
            TerraTern partner tiers control candidate shortlist ranking in employer search, candidate identity reveal status, maximum concurrent job application caps, and priority boost access. Higher tiers receive reduced platform placement fees and dedicated account management.
          </p>
        </div>
      </div>

      {/* Available Offerings List */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#1B3270]">
            Available Candidate Academy Programs & Courses
          </h3>
          <p className="text-xs text-[#94A3B8]">
            Enhancement curricula available for candidates needing gate retake preparation.
          </p>
        </div>

        {offerings.length === 0 ? (
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-12 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-2">
            <BookOpen size={32} className="mx-auto text-[#94A3B8]" />
            <h4 className="text-base font-semibold text-[#1B3270]">
              No offerings available at this time.
            </h4>
            <p className="text-xs text-[#94A3B8]">
              Check back for updated German language courses and clinical simulation bootcamps.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offerings.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col justify-between hover:border-[#7EB3E8] transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-[#1B3270] leading-snug">
                      {item.name}
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] whitespace-nowrap">
                      {getOfferingTypeLabel(item.type)}
                    </span>
                  </div>

                  <p className="text-xs text-[#4A5568] mb-4 leading-relaxed line-clamp-3">
                    {item.description || 'Specialized qualification enhancement track.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-between text-xs">
                  <div className="flex items-center text-[#94A3B8]">
                    <GraduationCap size={14} className="mr-1" />
                    <span>Applicable: <strong>{item.applicable_gate ? getGateLabel(item.applicable_gate) : 'All Gates'}</strong></span>
                  </div>

                  <span className="text-sm font-bold text-[#1B3270]">
                    €{item.price}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
