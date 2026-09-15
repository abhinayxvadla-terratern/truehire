import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Database,
  RefreshCw,
  Server,
  Shield,
  Info,
} from 'lucide-react';

export const SettingsTab: React.FC = () => {
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = async () => {
    setChecking(true);
    const start = performance.now();
    try {
      const { error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);

      if (error) {
        console.error('Supabase ping check error:', error);
        setDbConnected(false);
      } else {
        setDbConnected(true);
      }
    } catch (err) {
      console.error('Connection test error:', err);
      setDbConnected(false);
    } finally {
      setChecking(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B3270]">Platform Settings & Diagnostics</h1>
        <p className="text-sm text-slate-500 mt-1">
          System infrastructure parameters, cloud database latency, and deployment metadata.
        </p>
      </div>

      {/* SECTION 1: SUPABASE CONNECTION STATUS */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-[#1B3270]" />
            <h2 className="text-base font-bold text-slate-800">
              Supabase Cloud Connectivity
            </h2>
          </div>
          <button
            type="button"
            onClick={checkConnection}
            disabled={checking}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Pinging...' : 'Test Connection'}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4] gap-4">
          <div className="flex items-center space-x-3">
            {dbConnected === null ? (
              <div className="w-3.5 h-3.5 rounded-full bg-slate-300 animate-ping" />
            ) : dbConnected ? (
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm" />
            )}

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-slate-900">
                  {dbConnected === null
                    ? 'Testing...'
                    : dbConnected
                    ? 'Connected'
                    : 'Connection Error'}
                </span>
                {dbConnected && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Target query <code className="bg-white px-1 py-0.5 rounded border border-[#E2E8F4] font-mono text-[11px]">SELECT count(*) FROM profiles</code>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs text-slate-500">
            {latencyMs !== null && (
              <div>
                <span className="block text-[11px] text-slate-400">Response Latency</span>
                <span className="font-mono font-bold text-slate-800">{latencyMs} ms</span>
              </div>
            )}
            {lastChecked && (
              <div>
                <span className="block text-[11px] text-slate-400">Last Verified</span>
                <span className="font-mono text-slate-700">
                  {lastChecked.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-3.5 rounded-[6px] bg-slate-50 border border-[#E2E8F4] text-xs text-slate-600 flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-[#1B3270] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Note:</strong> Advanced database settings, replication rules, backup schedules, and row-level security definitions are managed directly via the Supabase Dashboard.
          </p>
        </div>
      </div>

      {/* SECTION 2: PLATFORM INFO */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-[#E2E8F4]">
          <Server className="w-5 h-5 text-[#1B3270]" />
          <h2 className="text-base font-bold text-slate-800">
            Platform Specifications
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Application Name
            </span>
            <span className="font-bold text-slate-900 text-sm">TerraTern TrueHire</span>
          </div>

          <div className="p-3.5 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Build Version
            </span>
            <span className="font-mono font-bold text-[#1B3270] text-sm">v1.4.0-internal</span>
          </div>

          <div className="p-3.5 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Primary Jurisdiction & Timezone
            </span>
            <span className="font-medium text-slate-800">
              Germany (Europe / Berlin, UTC+1 / UTC+2 CEST)
            </span>
          </div>

          <div className="p-3.5 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Security Architecture
            </span>
            <span className="font-medium text-slate-800">
              PostgreSQL Row Level Security (RLS) + JWT Auth
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: ROLE PERMISSIONS SUMMARY */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-3">
        <div className="flex items-center space-x-2 pb-3 border-b border-[#E2E8F4]">
          <Shield className="w-5 h-5 text-[#1B3270]" />
          <h2 className="text-base font-bold text-slate-800">
            Internal Role Hierarchy
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          The internal permission matrix designates operational responsibilities across German healthcare recruitment:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded border border-blue-100 bg-blue-50/50">
            <span className="font-bold text-blue-900 block">Executive & Governance</span>
            <p className="text-[11px] text-blue-700 mt-1">Super Admin</p>
          </div>
          <div className="p-3 rounded border border-indigo-100 bg-indigo-50/50">
            <span className="font-bold text-indigo-900 block">Partnerships & RM</span>
            <p className="text-[11px] text-indigo-700 mt-1">
              Partnerships Lead, Supplier & Employer Associates, Candidate RM, Employer RM
            </p>
          </div>
          <div className="p-3 rounded border border-emerald-100 bg-emerald-50/50">
            <span className="font-bold text-emerald-900 block">Clinical & Academic</span>
            <p className="text-[11px] text-emerald-700 mt-1">
              Academic Lead, Clinical & Language Mentors, Placement Lead
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
