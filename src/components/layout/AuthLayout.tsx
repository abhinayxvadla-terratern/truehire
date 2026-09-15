import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  badge?: string;
  children: React.ReactNode;
  bottomLinks?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  badge,
  children,
  bottomLinks,
}) => {
  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row bg-[#F8FAFD]">
      {/* ── LEFT PANEL (Desktop only: 50%) ── */}
      <div className="hidden md:flex md:w-1/2 min-h-screen flex-col items-center justify-center p-8 select-none [background:linear-gradient(145deg,#1B3270_0%,#2952A3_100%)]">
        <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
          <img
            src="/images/terratern-logo-horizontal-white.png"
            alt="TerraTern"
            className="h-[36px] w-auto object-contain"
          />
        </Link>
        <p className="text-[14px] text-white/60 mt-3 font-normal tracking-wide">
          Connect. Qualify. Place.
        </p>
        {badge && (
          <div className="mt-4 px-2.5 py-0.5 rounded-[4px] bg-[#F0F4FF] text-[#1B3270] text-[11px] font-medium tracking-wide">
            {badge}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL (Desktop: 50%, Mobile: full) ── */}
      <div className="w-full md:w-1/2 min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[400px]">
          {/* Mobile top logo (hidden on desktop) */}
          <div className="md:hidden text-center mb-6">
            <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
              <img
                src="/images/terratern-logo-horizontal.png"
                alt="TerraTern"
                className="h-[32px] w-auto object-contain mx-auto"
              />
            </Link>
            {badge && (
              <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-[4px] bg-[#F0F4FF] text-[#1B3270] text-[11px] font-medium tracking-wide">
                {badge}
              </div>
            )}
          </div>

          {/* White Form Card */}
          <div className="w-full bg-white border border-[#E2E8F4] rounded-[16px] p-6 sm:p-[48px_40px] shadow-[0_4px_24px_rgba(27,50,112,0.06)]">
            <h1 className="text-[22px] font-bold text-[#1B3270] tracking-tight leading-tight">
              {title}
            </h1>
            <p className="text-[13px] text-[#4A5568] mt-1 mb-6 leading-relaxed">
              {subtitle}
            </p>

            {children}
          </div>

          {/* Bottom Links outside Card */}
          {bottomLinks && (
            <div className="mt-6 text-center text-[13px] text-[#4A5568]">
              {bottomLinks}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
