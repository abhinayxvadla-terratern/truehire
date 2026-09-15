import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Building2, ArrowRight, AlertTriangle } from 'lucide-react';

export const Invite: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = paramToken || searchParams.get('token');
  const navigate = useNavigate();

  const [inviteData, setInviteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const resolveInvite = async () => {
      if (!token) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_invite_details', {
          p_token: token,
        });

        if (error || !data || data.length === 0) {
          setInvalid(true);
        } else {
          setInviteData(data[0]);
        }
      } catch (err) {
        console.error('Error verifying invite token:', err);
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    };

    resolveInvite();
  }, [token]);

  const handleProceed = () => {
    navigate(
      `/register?token=${encodeURIComponent(token || '')}&role=candidate&firstName=${encodeURIComponent(
        inviteData?.first_name || ''
      )}&lastName=${encodeURIComponent(inviteData?.last_name || '')}`
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] p-8 text-center animate-in fade-in duration-200">
        <h1 className="text-[24px] font-bold text-[#1B3270] tracking-tight leading-tight">
          TerraTern
        </h1>
        <p className="text-[13px] text-[#94A3B8] mt-1 font-normal mb-8">
          Connect. Qualify. Place.
        </p>

        {invalid ? (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-base font-bold text-[#1B3270]">Invalid Invite Link</h2>
            <p className="text-xs text-[#4A5568] leading-relaxed">
              This invite link is invalid or has expired. Request a new invite link from your channel partner.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="py-2 px-6 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-full bg-[#7EB3E8]/20 text-[#1B3270] flex items-center justify-center mx-auto">
              <Building2 size={24} />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#1B3270]">
                You've been invited to TerraTern by{' '}
                <span className="text-[#2952A3]">
                  {inviteData?.supplier_company_name || 'your Agency Partner'}
                </span>
              </h2>
              <p className="text-xs text-[#4A5568] leading-relaxed pt-1">
                {inviteData?.first_name
                  ? `Welcome, ${inviteData.first_name}! Your profile has been initiated for German healthcare opportunities.`
                  : 'Your qualification and placement pathway to Germany starts here.'}
              </p>
            </div>

            {inviteData?.target_role && (
              <div className="inline-flex items-center space-x-1 px-3 py-1 bg-[#7EB3E8]/15 border border-[#7EB3E8]/25 rounded-full text-xs font-semibold text-[#2952A3]">
                <span>Target Track:</span>
                <span className="capitalize">{inviteData.target_role}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleProceed}
                className="w-full py-2.5 px-4 bg-[#1B3270] hover:bg-[#2952A3] text-white text-sm font-medium rounded-[6px] transition-colors shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex items-center justify-center space-x-2"
              >
                <span>Create your account to begin</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
