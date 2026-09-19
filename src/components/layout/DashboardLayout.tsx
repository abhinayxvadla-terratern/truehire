import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { getInternalDashboardPath } from '../../utils/internalRouting';
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  LucideIcon,
  LogOut,
  User,
  Shield,
  Briefcase,
  Building2,
  Building,
  Award,
  Users,
  FileText,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatters';

const ROLE_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon }
> = {
  super_admin: { label: 'Super Admin', icon: Shield },
  partnerships_lead: { label: 'Partnerships Lead', icon: Briefcase },
  supplier_partnerships_associate: { label: 'Supplier Partnerships', icon: Building2 },
  employer_partnerships_associate: { label: 'Employer Partnerships', icon: Building },
  placement_lead: { label: 'Placement Lead', icon: Award },
  candidate_supplier_rm: { label: 'Candidate RM', icon: Users },
  employer_requirements_rm: { label: 'Employer RM', icon: FileText },
  academic_lead: { label: 'Academic Lead', icon: GraduationCap },
  mentor: { label: 'Mentor', icon: BookOpen },
};

export interface NavItemConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  section?: string;
  isDividerBefore?: boolean;
}

interface DashboardLayoutProps {
  navItems: NavItemConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  roleBadge?: string;
  isInternal?: boolean;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  navItems,
  activeTab,
  onTabChange,
  roleBadge,
  isInternal = false,
  children,
}) => {
  const {
    user,
    profile,
    allRoles,
    activeRole,
    hasMultipleRoles,
    setActiveRole,
    signOut,
  } = useAuth();
  const navigate = useNavigate();

  // Mobile sidebar drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Profile dropdown (in sidebar bottom)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Role switcher dropdown
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const roleSwitcherRef = useRef<HTMLDivElement>(null);

  // Notification bell state & dropdown
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Active item title
  const currentNavItem = navItems.find((item) => item.id === activeTab);
  const pageTitle = currentNavItem?.label || 'Dashboard';

  // Fetch notifications for the user
  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.read).length);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
      if (
        roleSwitcherRef.current &&
        !roleSwitcherRef.current.contains(e.target as Node)
      ) {
        setRoleSwitcherOpen(false);
      }
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(e.target as Node)
      ) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate(isInternal ? '/internal/login' : '/login', { replace: true });
  };

  // Avatar initials
  const initials = (
    (profile?.first_name?.[0] || '') + (profile?.last_name?.[0] || '')
  ).toUpperCase() || (profile?.email?.[0] || 'U').toUpperCase();

  const displayName =
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
    profile?.email ||
    'User Profile';

  // Group nav items by section
  let lastSection = '';

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden">
      {/* Top Logo Area (56px) */}
      <div className="h-[56px] px-3.5 lg:px-4 border-b border-[#E2E8F4] flex items-center justify-between shrink-0">
        <div className="flex items-center overflow-hidden">
          {/* Tablet collapsed icon mark (hidden on desktop or mobile drawer, shown only on tablet collapsed) */}
          {!isMobile && (
            <img
              src="/images/terratern-logo-blue.png"
              alt="TerraTern"
              className="h-[28px] w-auto object-contain hidden md:block lg:hidden group-hover/sidebar:hidden"
            />
          )}
          {/* Full logo (shown on mobile, desktop, and tablet when hovered) */}
          <img
            src="/images/terratern-logo-horizontal.png"
            alt="TerraTern"
            className={`h-[28px] w-auto object-contain ${
              !isMobile ? 'block md:hidden lg:block group-hover/sidebar:block' : 'block'
            }`}
            onError={(e) => {
              // Wordmark fallback
              e.currentTarget.style.display = 'none';
              const fallback = document.getElementById(
                isMobile ? 'tt-wordmark-mobile' : 'tt-wordmark-desktop'
              );
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div
            id={isMobile ? 'tt-wordmark-mobile' : 'tt-wordmark-desktop'}
            className="hidden items-center"
          >
            <span className="text-[#1B3270] font-bold text-[16px]">Terra</span>
            <span className="text-[#2952A3] font-normal text-[16px]">Tern</span>
          </div>
        </div>

        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1 rounded text-[#94A3B8] hover:text-[#1B3270]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav List Middle */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const showSectionHeader = Boolean(
            item.section && item.section !== lastSection
          );
          if (item.section) {
            lastSection = item.section;
          }

          return (
            <React.Fragment key={item.id}>
              {item.isDividerBefore && (
                <div className="h-px bg-[#E2E8F4] my-2" />
              )}
              {showSectionHeader && (
                <div className="px-3 pt-4 pb-1.5 text-[11px] font-semibold text-[#94A3B8] tracking-[0.06em] uppercase hidden lg:block group-hover/sidebar:block truncate">
                  {item.section}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  if (isMobile) setMobileDrawerOpen(false);
                }}
                className={`w-full h-[40px] px-2.5 lg:px-3 rounded-[8px] flex items-center gap-2.5 transition-all text-[13px] text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#F0F4FF] text-[#1B3270] font-medium [box-shadow:inset_3px_0_0_#1B3270]'
                    : 'text-[#4A5568] hover:bg-[#F0F4FF] hover:text-[#1B3270]'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                    isActive
                      ? 'stroke-[#1B3270]'
                      : 'stroke-[#94A3B8] group-hover:stroke-[#1B3270]'
                  }`}
                  strokeWidth={1.5}
                />
                <span className="truncate flex-1 hidden lg:inline group-hover/sidebar:inline">
                  {item.label}
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-semibold hidden lg:inline group-hover/sidebar:inline ${
                      isActive
                        ? 'bg-[#1B3270] text-white'
                        : 'bg-[#F0F4FF] text-[#1B3270]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Bottom Profile Identity Area */}
      <div className="border-t border-[#E2E8F4] p-2 relative shrink-0" ref={profileMenuRef}>
        {/* Floating Dropdown Card (opens above) */}
        {profileMenuOpen && (
          <div className="absolute bottom-[60px] left-2 right-2 bg-white border border-[#E2E8F4] rounded-[12px] shadow-[0_4px_16px_rgba(27,50,112,0.12)] p-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 min-w-[180px]">
            {!isInternal && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('profile');
                    setProfileMenuOpen(false);
                    if (isMobile) setMobileDrawerOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#4A5568] hover:text-[#1B3270] hover:bg-[#F0F4FF] rounded-[8px] text-left cursor-pointer transition-colors"
                >
                  <User className="w-4 h-4 stroke-[#94A3B8]" strokeWidth={1.5} />
                  <span>My Profile</span>
                </button>
                <div className="h-px bg-[#E2E8F4] my-1" />
              </>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#EF4444] hover:bg-[#FEF2F2] rounded-[8px] text-left cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4 stroke-[#EF4444]" strokeWidth={1.5} />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Identity Row */}
        <div
          onClick={() => setProfileMenuOpen((prev) => !prev)}
          className="h-[44px] px-2.5 lg:px-3 rounded-[8px] flex items-center gap-2.5 hover:bg-[#F0F4FF] cursor-pointer transition-colors"
        >
          {/* Avatar 30px */}
          <div className="w-[30px] h-[30px] rounded-full bg-[#F0F4FF] text-[#1B3270] flex items-center justify-center font-bold text-[12px] shrink-0 border border-[#E2E8F4]">
            {initials}
          </div>
          {/* User Name */}
          <span className="flex-1 text-[13px] font-medium text-[#1B3270] truncate hidden lg:inline group-hover/sidebar:inline">
            {displayName}
          </span>
          {/* Chevron */}
          <span className="hidden lg:inline group-hover/sidebar:inline">
            {profileMenuOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            )}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFD] text-[#4A5568] overflow-x-hidden">
      {/* ── DESKTOP & TABLET SIDEBAR ── */}
      <aside className="group/sidebar hidden md:flex flex-col w-[60px] lg:w-[220px] md:hover:w-[220px] fixed left-0 top-0 h-screen bg-white border-r border-[#E2E8F4] z-40 transition-[width,box-shadow] duration-200 md:hover:shadow-[0_4px_24px_rgba(27,50,112,0.12)]">
        {renderSidebarContent(false)}
      </aside>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-200 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-[280px] max-w-[80%] bg-white h-full shadow-2xl flex flex-col z-201 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* ── TOPBAR ── */}
      <header className="fixed top-0 left-0 md:left-[60px] lg:left-[220px] right-0 h-[56px] bg-white border-b border-[#E2E8F4] z-30 flex items-center justify-between px-4 sm:px-7 transition-[left] duration-200">
        {/* Left: Hamburger (mobile) + Page Title */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden p-1.5 rounded-[6px] text-[#1B3270] hover:bg-[#F0F4FF] cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <h1 className="text-[16px] font-semibold text-[#1B3270] leading-none">
            {pageTitle}
          </h1>
        </div>

        {/* Right: Role Switcher / Role Badge & Notification Bell */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Multi-role Switcher (visible ONLY when hasMultipleRoles = true) */}
          {isInternal && hasMultipleRoles ? (
            <div className="relative" ref={roleSwitcherRef}>
              <button
                type="button"
                onClick={() => setRoleSwitcherOpen((prev) => !prev)}
                className="bg-[#F0F4FF] border border-[#E2E8F4] rounded-[99px] py-1 pl-2 pr-3 flex items-center gap-1.5 transition-colors hover:border-[#1B3270]/30 cursor-pointer select-none"
                aria-label="Switch role"
              >
                {/* Small green dot indicator (home indicator) if currently on primary dashboard */}
                {(activeRole === profile?.internal_role || (!activeRole && profile?.internal_role)) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
                {(() => {
                  const currentRoleKey = activeRole || profile?.internal_role || '';
                  const conf = ROLE_CONFIG[currentRoleKey] || { label: 'Internal Staff', icon: User };
                  const RoleIcon = conf.icon;
                  return (
                    <>
                      <RoleIcon className="w-3.5 h-3.5 text-[#1B3270] shrink-0" />
                      <span className="text-[12px] font-medium text-[#1B3270] whitespace-nowrap">
                        {conf.label}
                      </span>
                    </>
                  );
                })()}
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {/* Role Switcher Dropdown (expanded state) */}
              {roleSwitcherOpen && (
                <div className="absolute right-0 top-[38px] w-[230px] bg-white border border-[#E2E8F4] rounded-[12px] shadow-lg py-2 z-200 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 pb-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 select-none">
                    SWITCH ROLE
                  </div>
                  <div className="space-y-0.5 px-1">
                    {allRoles.map((r) => {
                      const conf = ROLE_CONFIG[r] || { label: r, icon: User };
                      const RoleIcon = conf.icon;
                      const isPrimary = r === profile?.internal_role;
                      const isActive = r === (activeRole || profile?.internal_role);

                      return (
                        <div
                          key={r}
                          onClick={() => {
                            setActiveRole(r);
                            setRoleSwitcherOpen(false);
                            navigate(getInternalDashboardPath(r));
                          }}
                          className={`h-[40px] px-3 rounded-[8px] flex items-center gap-2.5 cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-[#F0F4FF] text-[#1B3270] font-medium'
                              : 'hover:bg-[#F8FAFD] text-slate-700'
                          }`}
                        >
                          <RoleIcon className="w-3.5 h-3.5 text-[#1B3270] shrink-0" />
                          <span className="text-[13px] truncate flex-1">{conf.label}</span>
                          {isPrimary && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-[#6B7280]">
                              Primary
                            </span>
                          )}
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1B3270] shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Single-role internal or external badge */
            roleBadge && (
              <div className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-[4px] bg-[#F0F4FF] text-[#1B3270] text-[11px] font-medium tracking-wide">
                {roleBadge}
              </div>
            )
          )}

          {/* Notification Bell Dropdown */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              type="button"
              onClick={() => setNotifDropdownOpen((prev) => !prev)}
              className="p-2 rounded-[8px] text-[#4A5568] hover:text-[#1B3270] hover:bg-[#F0F4FF] relative transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 stroke-[#1B3270]" strokeWidth={1.5} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-white" />
              )}
            </button>

            {/* Notification Dropdown Panel (320px) */}
            {notifDropdownOpen && (
              <div className="absolute right-0 top-[44px] w-[320px] max-h-[400px] overflow-y-auto bg-white border border-[#E2E8F4] rounded-[12px] shadow-[0_4px_16px_rgba(27,50,112,0.12)] z-100 animate-in fade-in zoom-in-95 duration-100">
                {/* Header */}
                <div className="px-4 py-3 border-b border-[#E2E8F4] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#1B3270]">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#2952A3] hover:underline font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Items */}
                {notifications.length === 0 ? (
                  <div className="py-8 px-4 text-center text-[12px] text-[#94A3B8]">
                    No notifications
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F4]">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 flex items-start gap-2.5 hover:bg-[#F0F4FF]/50 transition-colors"
                      >
                        {/* Unread dot 8px */}
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                            !n.read ? 'bg-[#1B3270]' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-[#1B3270] truncate leading-tight">
                            {n.title || n.message}
                          </p>
                          <span className="text-[11px] text-[#94A3B8] block mt-0.5">
                            {n.created_at ? formatTimeAgo(n.created_at) : 'Just now'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="md:ml-[60px] lg:ml-[220px] pt-[76px] sm:pt-[84px] px-4 sm:px-7 pb-10 min-h-screen bg-[#F8FAFD] transition-[margin-left] duration-200 min-w-0">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
