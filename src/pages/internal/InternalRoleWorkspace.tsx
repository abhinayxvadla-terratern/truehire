import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { InternalShell } from '../../components/internal/InternalShell';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Building2,
  Briefcase,
  Award,
  BookOpen,
  CheckCircle2,
  Layers,
  Bell,
  Shield,
} from 'lucide-react';

const ROLE_METADATA: Record<
  string,
  {
    title: string;
    description: string;
    responsibilities: string[];
    icon: any;
  }
> = {
  partnerships_lead: {
    title: 'Partnerships Lead Workspace',
    description: 'Lead external agency networks, institutional affiliations, and German employer contracts.',
    responsibilities: [
      'Oversee supplier onboarding, verification tiers, and compliance audit declarations.',
      'Manage healthcare employer relationships and staffing capacity quotas.',
      'Coordinate between recruitment agencies and internal placement specialists.',
    ],
    icon: Building2,
  },
  supplier_partnerships_associate: {
    title: 'Supplier Partnerships Workspace',
    description: 'Coordinate talent sourcing pipelines, overseas channel partners, and supplier verification.',
    responsibilities: [
      'Vet candidate sourcing agencies and verify no-fee policy declarations.',
      'Track supplier-introduced candidate volumes and conversion rates.',
      'Maintain continuous liaison with certified recruitment channel partners.',
    ],
    icon: Building2,
  },
  employer_partnerships_associate: {
    title: 'Employer Partnerships Workspace',
    description: 'Facilitate healthcare facility staffing allocations, interview scheduling, and demand intakes.',
    responsibilities: [
      'Collect and publish job requirements for German hospitals and care facilities.',
      'Manage employer interview pipelines and candidate shortlisting.',
      'Verify candidate placement contracts and employer satisfaction scores.',
    ],
    icon: Briefcase,
  },
  placement_lead: {
    title: 'Placement Lead Workspace',
    description: 'Direct candidate allocation to open positions and oversee relocation & visa progress.',
    responsibilities: [
      'Match interview-ready candidates with active healthcare job requirements.',
      'Monitor employer interview outcomes and contract issuance.',
      'Coordinate immigration, visa documentation, and arrival logistics.',
    ],
    icon: Layers,
  },
  candidate_supplier_rm: {
    title: 'Candidate & Supplier RM Workspace',
    description: 'Dedicated relationship management for overseas candidates and regional agency suppliers.',
    responsibilities: [
      'Monitor candidate progression through language milestones (A1–B2).',
      'Resolve supplier escalations and candidate onboarding queries.',
      'Ensure high candidate engagement and timely document submissions.',
    ],
    icon: Users,
  },
  employer_requirements_rm: {
    title: 'Employer Requirements RM Workspace',
    description: 'Dedicated relationship manager managing open facility positions and demand specifications.',
    responsibilities: [
      'Review clinical staffing specifications and language prerequisites.',
      'Optimize candidate-to-vacancy fit scoring and presentation packages.',
      'Track employer review velocity and interview feedback turnaround.',
    ],
    icon: Briefcase,
  },
  academic_lead: {
    title: 'Academic Lead Workspace',
    description: 'Direct German curriculum delivery, Defizitbescheid evaluation, and language accreditation.',
    responsibilities: [
      'Standardize German B1/B2 curriculum and clinical German training.',
      'Evaluate nursing recognition certificates and adaptation training plans.',
      'Audit gate assessment scores submitted by language instructors.',
    ],
    icon: BookOpen,
  },
  mentor: {
    title: 'Clinical & Language Mentor Workspace',
    description: 'Direct mentorship, 1-on-1 language coaching, and clinical orientation for nursing candidates.',
    responsibilities: [
      'Conduct speaking practice and clinical terminology workshops.',
      'Evaluate language gate milestones (A1, A2, B1, B2).',
      'Provide individualized coaching for candidate German hospital interviews.',
    ],
    icon: Award,
  },
};

export const InternalRoleWorkspace: React.FC = () => {
  const { profile } = useAuth();

  const roleKey = profile?.internal_role || 'staff';
  const meta = ROLE_METADATA[roleKey] || {
    title: 'Internal Team Workspace',
    description: 'Operational center for TerraTern international mobility operations.',
    responsibilities: [
      'Coordinate international healthcare recruitment workflows.',
      'Track candidate readiness and clinical credentialing.',
    ],
    icon: Shield,
  };

  const Icon = meta.icon;

  const [myNotifications, setMyNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!profile?.id) return;
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(10);

        setMyNotifications(data || []);
      } catch (e) {
        console.error('Error fetching role notifications:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [profile?.id]);

  return (
    <InternalShell>
      <div className="space-y-6">
        {/* Banner Card */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-5">
            <div className="w-14 h-14 rounded-xl bg-[#F0F4FF] border border-[#2952A3]/20 text-[#1B3270] flex items-center justify-center shrink-0">
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-[#1B3270]">{meta.title}</h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{meta.description}</p>
            </div>
          </div>
        </div>

        {/* Operational Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Functional Responsibilities */}
          <div className="md:col-span-2 bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-[#E2E8F4]">
              <CheckCircle2 className="w-5 h-5 text-[#1B3270]" />
              <h2 className="text-base font-bold text-slate-800">
                Core Functional Duties
              </h2>
            </div>

            <ul className="space-y-3 text-xs text-slate-700">
              {meta.responsibilities.map((resp, idx) => (
                <li key={idx} className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F0F4FF] text-[#2952A3] font-bold flex items-center justify-center shrink-0 text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{resp}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4 border-t border-[#E2E8F4] text-xs text-slate-500">
              <p>
                As an authorized TerraTern team member, your actions adhere to GDPR, the German Skilled Immigration Act (FEG), and ethical WHO recruitment standards.
              </p>
            </div>
          </div>

          {/* Account Profile Card */}
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-[#E2E8F4]">
              <Shield className="w-5 h-5 text-[#1B3270]" />
              <h2 className="text-base font-bold text-slate-800">Staff Account</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Authorized Name</span>
                <span className="font-bold text-slate-800 text-sm">
                  {profile?.first_name} {profile?.last_name}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Internal Email</span>
                <span className="font-mono text-slate-700">{profile?.email}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Designated Role</span>
                <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded font-semibold bg-[#F0F4FF] text-[#2952A3] border border-[#2952A3]/10">
                  {profile?.internal_role?.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Access Tier</span>
                <span className="font-medium text-emerald-700 flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Authenticated Internal Staff</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Notifications */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5 text-[#1B3270]" />
              <h2 className="text-base font-bold text-slate-800">
                Direct Notifications ({myNotifications.length})
              </h2>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 py-3">Loading notifications...</p>
          ) : myNotifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <Bell className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p>No new notifications assigned to your account.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F4] text-xs">
              {myNotifications.map((n) => (
                <div key={n.id} className="py-3 flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{n.title}</p>
                    <p className="text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-4">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </InternalShell>
  );
};
